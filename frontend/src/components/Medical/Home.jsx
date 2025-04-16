import React from 'react';
import useGetAllProducts from '../../hooks/useGetAllProducts';
import { Link } from 'react-router-dom';
import HeroImg from "../../assets/heroimg.jpg";
import Footer from "../Footer/Footer";
import NavBar from '../Header/NavBar';
import Hero from './Hero';
import ProductCard from '../ProductCard';
import "./medical.css";
import svg from "../../assets/ticksvg.svg"
import FeatureCard from './FeatureCard';


function Home() {

  const { products } = useGetAllProducts();
  
      return (
          <div className='main-div'>
              {/* <NavBar /> */}
  
              <Hero 
                  imgSrc = {HeroImg}
              />
  
              <div className="container">
                  <h2 className="#">Why US ?</h2>
  
                  <div className='sub-container'>
                      <FeatureCard
                          svg={svg}
                          title="Title"
                          description="Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo."
                      />
                      <FeatureCard
                          svg={svg}
                          title="Title"
                          description="Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt."
                      />
                      <FeatureCard
                          svg={svg}
                          title="Title"
                          description="Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. "
                      />
                  </div>
              </div>
  
              <hr style={{width:"75%", border:"solid rgba(56, 54, 54, 0.12) 1px", boxShadow:"3px 3px 5px rgba(77, 75, 75, 0.22)", alignSelf:"center", margin:"20px"}}/>

              <div className="container">
                  <h2>Products ?</h2>
  
                  <div className='sub-container'>
  
                  {products.map(
                      product => (
                        <Link 
                        to={`/products/${product.id}`} 
                        key={product.id}
                        >
                          <ProductCard
                          key={product.id}
                          link={product.link}
                          title={product.title}
                          image={`http://localhost:3000/uploads/${product.filename}`}
                          brand="DMDailyDeals"
                          description={product.description}
                        />
                      </Link>
                      )
                    )
                      }
                      
                  </div>
              </div>

              {/* <hr style={{width:"75%", border:"solid rgba(56, 54, 54, 0.462) 2px", boxShadow:"3px 3px 5px rgba(56, 54, 54, 0.19)", alignSelf:"center"}}/>
  
              <Footer /> */}
  
          </div>

      )
  }
  
  export default Home;