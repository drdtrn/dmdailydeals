import React from 'react';
import useGetAllProducts from '../../hooks/useGetAllProducts';
import { Link } from 'react-router-dom';
import HeroImg from "../../assets/heroimg.jpg";
import Hero from './Hero';
import ProductCard from '../ProductCard';
import "./medical.css";
import svg from "../../assets/ticksvg.svg"
import FeatureCard from './FeatureCard';

function Home() {

  const { products } = useGetAllProducts();
  
      return (
          <div className='flex flex-col items-center'>
  
            <Hero imgSrc = {HeroImg} />

            <div className="flex flex-col">

                <h2 className="text-[min(7vw,50px)] border-b-2 border-t-2 border-solid border-gray-400">Why US ?</h2>
                <div className='flex m-10 gap-10 p-10 flex-wrap'>
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

            <hr style={{width:"80%", border:"solid rgba(56, 54, 54, 0.12) 1px", boxShadow:"3px 3px 5px rgba(77, 75, 75, 0.22)", alignSelf:"center", margin:"20px"}}/>
            
            <div className="flex flex-col items-center">

                <h2 className='text-[min(7vw,50px)] border-b-2 border-t-2 border-solid border-gray-400'>Products </h2>
                <div className='flex gap-10 p-10'>
                {products.slice(0, 3).map(
                    (product, index) => (
                      <Link 
                      to={`/products/${product.id}`} 
                      key={product.id}
                      className={index === 2 ? 'hidden lg:block' : ''}
                      >
                        <ProductCard
                        key={product.id}
                        link={product.link}
                        title={product.title}
                        image={`http://${import.meta.env.VITE_CURRENT_IP}:3000/uploads/${product.filename}`}
                        brand="DMDailyDeals"
                        description={product.description}
                      />
                    </Link>
                    )
                  )
                    }

                </div>
                <Link className='link' to={`/allProducts`} key={2} >See more...</Link>
            </div>
                    
            <hr style={{width:"80%", border:"solid rgba(56, 54, 54, 0.12) 1px", boxShadow:"3px 3px 5px rgba(77, 75, 75, 0.22)", alignSelf:"center", margin:"20px"}}/>
            
          </div>

      )
  }
  
  export default Home;