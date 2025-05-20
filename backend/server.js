import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import env from "dotenv";
import multer from "multer";
import cors from "cors";

const app = express();
const port = 3000;
const saltRounds = 10;

env.config();

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

db.connect();

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Uploads will be saved in 'uploads' directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // Unique filename
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "image/png" || file.mimetype === "image/jpeg") {
      cb(null, true);
    } else {
      cb(new Error("Only .png and .jpeg formats allowed!"), false);
    }
  },
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB limit
  },
});

// Body Parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Express session middleware
app.use(
  // This is used to set up a session on the website
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// CORS
app.use(
  cors({
    origin: `http://${process.env.CURRENT_IP}:5173`,
  })
);

// IMG handling
app.use("/uploads", express.static("uploads"));

// REST
app.get("/", (req, res) => {
  res.send("YEEEE");
});

app.get("/admin", (req, res) => {
  res.render("admin-login.ejs");
});

app.get("/register", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("register.ejs", { error: " " });
  } else {
    res.redirect("/admin");
  }
});

app.get("/controlPanel", (req, res) => {
  // The .isAuthenticated() function comes from the passport middleware. It checks if the user is authenticated or not !
  if (req.isAuthenticated()) {
    res.render("admin-panel.ejs");
  } else {
    res.redirect("/admin");
  }
});

app.get("/create", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("creation-panel.ejs");
  } else {
    res.redirect("/admin");
  }
});

app.get("/products", async (req, res) => {
  if (req.isAuthenticated()) {
    const result = await db.query("SELECT * FROM products");
    const products = result.rows;

    res.render("products/products.ejs", { products: products });
  } else {
    res.redirect("/admin");
  }
});

app.get("/product/:id", async (req, res) => {
  if (req.isAuthenticated()) {
    const prodId = req.params.id;
    const result = await db.query("SELECT * FROM products WHERE id=$1", [
      prodId,
    ]);
    // res.json(prod.rows);
    const [product] = result.rows;
    // console.log(product);

    res.render("products/product-update.ejs", { product });
  } else {
    res.redirect("/admin");
  }
});

app.post("/update", upload.single("filepath"), async (req, res) => {
  const filteredBody = {};
  var prodId = 0;
  for (const key in req.body) {
    if (req.body[key]) {
      filteredBody[key] = req.body[key];
      const column = key;
      const value = req.body[key];
      const id = parseInt(req.body.id);
      prodId = parseInt(req.body.id);
    }
  }

  const noIdFilteredBody = delete filteredBody.id;
  for (const key in filteredBody) {
    const column = key;
    const value = filteredBody[key];
    // console.log(`UPDATE products SET ${column} = ${value} WHERE id=${prodId}`)
    await db.query(
      `UPDATE products SET ${column} = '${value}' WHERE id=${prodId}`
    );
  }

  res.redirect("/products");
});

app.post("/delete", async (req, res) => {
  const prodId = req.body.id;
  await db.query(" DELETE FROM products WHERE id=$1", [prodId]);
  res.redirect("/products");
});

app.post("/register", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  bcrypt.hash(password, saltRounds, async (hashEerr, hash) => {
    if (hashEerr) {
      console.log(hashEerr);
    } else {
      const result = await db.query(
        "INSERT INTO admin (username, password) VALUES ($1, $2) RETURNING *",
        [username, hash]
      );
      const user = result.rows[0];

      // Instead of just redirectiong, we initiate a user login first for the sake of recording data on the passport strategy
      req.login(user, (err) => {
        console.log(err);
        res.redirect("/controlPanel");
      });
    }
  });
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/controlPanel",
    failureRedirect: "/admin",
  })
);

app.post("/upload", upload.single("filepath"), async (req, res) => {
  if (req.isAuthenticated()) {
    // title, description, alttext, keywords, filepath, link
    const title = req.body.title;
    const desc = req.body.description;
    const alttxt = req.body.alttext;
    const kwd = req.body.keywords;
    const filepath = req.file.filename;
    // console.log(req.file)
    const link = req.body.link;
    const category = req.body.category;
    const uploadedProd = await db.query(
      "INSERT INTO products (title, description, alttext, keywords, filename, link, category) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [title, desc, alttxt, kwd, filepath, link, category]
    );
    console.log(uploadedProd.rows[0]);
    res.redirect("/controlPanel");
  } else {
    res.redirect("/admin");
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM products");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const paramId = req.params.id;
    const prod = await db.query("SELECT * FROM products WHERE id=$1", [
      paramId,
    ]);
    res.json(prod.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "server error" });
  }
});

app.get("/api/product-category/:category", async (req, res) => {
  try {
    const paramCategory = req.params.category;
    const prod = await db.query("SELECT * FROM products WHERE category=$1", [
      paramCategory,
    ]);
    res.json(prod.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "server error" });
  }
});

passport.use(
  new Strategy(async function verify(username, password, cb) {
    // This passport strategy automaticaly catches the input fields on the front end if
    // they are named the same as the parameters set on the function (username, passoword).
    // BEFORE setting this passport strategy the lines below were located in the /login post route.
    try {
      // NOTE: instead of db.query use prisma for postgresql
      const checkResponse = await db.query(
        "SELECT username, password FROM admin WHERE username = $1 ",
        [username]
      );
      const user = checkResponse.rows[0];
      const checkUsername = user.username;
      const checkPassword = user.password;

      bcrypt.compare(password, checkPassword, (compErr, result) => {
        if (compErr) {
          return cb(compErr);
        } else {
          console.log(result);
          if (result) {
            // console.log("Credentials are correct !");
            // res.render("secrets.ejs");
            // Instead of rendering like we did on the login post route we do this:
            return cb(null, user);
            // The user contains the user data and sets the .isAuthenticated() function in the /secrets get route to true
          } else {
            console.log("Email or password is incorrect !");
            return cb(null, false);
          }
        }
      });
    } catch (err) {
      console.log("You are not a registered user !");
      return cb(err);
    }
  })
);

passport.serializeUser((user, cb) => {
  // To save the data of the logged in user to the local storage
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  // To save the data of the logged in user to the local storage for later authentication ?
  cb(null, user);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
