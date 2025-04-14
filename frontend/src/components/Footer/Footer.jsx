import React, {useState} from "react";
import "./footer.css";

function Footer() {

  const currentYear = new Date().getFullYear()

    return (
        
        <footer id="footer">
          <div className="footer-div">
            <p >© {currentYear } EXAMPLE , LLC</p>
          </div>
      
        </footer>

    )
}

export default Footer;