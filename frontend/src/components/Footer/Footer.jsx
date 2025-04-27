import React, {useState} from "react";

function Footer() {

  const currentYear = new Date().getFullYear()

    return (
        
        <footer id="footer" className="flex justify-center h-[7vh] lg:h-[10vh] items-center">
          
          <div className="footer-div">
            <p >© {currentYear } EXAMPLE , LLC</p>
          </div>
      
        </footer>

    )
}

export default Footer;