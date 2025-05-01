import React, {useState} from "react";
import { Link } from 'react-router-dom';
import "./NavBar.css";

function NavBar() {
    
    return(
        <header className="header flex justify-between items-center bg-[#12372A] fixed z-100 top-0 left-0 w-[100%] px-[10%] py-[2vh] lg:py-[1vh]">
            <a href="/" className="logo text-[2.5rem] border-1">Logo</a>
            
            <nav className="navbar">
                <Link className="text-[1.5rem] lg:text-[1rem]" to={`/`} key={0} >Home</Link>
                <Link className="text-[1.5rem] lg:text-[1rem]" to={`/admin`} key={1} >Admin</Link>
                <Link className="text-[1.5rem] lg:text-[1rem]" to={`/allProducts`} key={2} >All Products</Link>
                <Link className="text-[1.5rem] lg:text-[1rem]" to={`/aboutUs`} key={3} >About Us</Link>
            </nav>
        </header>
    )
}

export default NavBar;