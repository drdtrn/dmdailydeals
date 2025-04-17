import React, { useState } from 'react'
import './DMstyles.css'

function myCv() {
    return (
        <body>
        <header>
            <div id="company-logo">
                <a href="#" className="com-logo">
                <img src="./src/assets/lowercaselogo.png" className="com-logo" alt="dmdailydeals company logo brand"/>
                </a>
            </div>
        </header>

        <div className="first-div section">
            <h1 className="radley-regular first-div-title"><span className="radley-regular-italic">Hello,</span> we are DM !</h1>
            <h2 className="carlito-regular first-div-content">Efficiency and precision are our guiding principles. Whether it's python, crafting targeted ads or building web solutions, we focus on delivering results with clarity and purpose.</h2>
            <div className="hire-me-div">
                <h2 className="radley-regular-italic hire-me">Hire us</h2>
                <hr className="solid"/>
            </div>

        </div>

        <div className="second-div section">
            <div className="cutout dv1"></div>
            <div className="cutout dv2"></div>
            <div className="cutout dv3"></div>
            <div className="cutout dv4"></div>
            <div className="cutout dv5"></div>
            <div className="cutout dv6"></div>
            <div className="cutout dv7"></div>

            <div className="cutout dv9"></div>
        </div>

        <div className="third-div section">
            <div className="profile-picture-div">
                <img src={"./src/assets/pic3.jpg"} alt="this website's creator profile picture" className="profile-picture"/>
            </div>
            <div className="name-div">
                <h1 className="radley-regular-italic">Dardan Tërnava, Founder, CEO & Lead Operator</h1>
                <h2 className="carlito-regular">Our leader Dardan, as an experienced eCommerce business owner and programmer, 
                    is passionate about building impactful online brands, developing Python scripts, 
                    and driving growth through targeted advertising. His focus is on crafting innovative 
                    solutions that elevate businesses in the digital marketplace. Whether optimizing 
                    user journeys or launching data-driven campaigns, his goal for the company is to deliver results that 
                    resonate with both businesses and their customers.</h2>

            </div>

        </div>

        <hr/>

        <div className="fourth-div section">
            <div className="background-div">
                <h1 className="radley-regular">Our CEO-s Background</h1>
            </div>
            <div className="certification">
                <a href="https://www.udemy.com/certificate/UC-6f6a3bc6-2cd9-4ad3-be59-7675d8a2b6a6/" target="_blank"><img src="static/elements/logo-udemy.svg" alt="udemy course bootcamp logo certification"/></a>
                <h1 className="radley-regular">100 Days of Code: The Complete Python Pro Bootcamp</h1>
                <hr/>

            </div>
            <div className="certification">
                <a href="https://www.udemy.com/certificate/UC-98805112-4c28-4774-ac57-18eea1bdd2e0/" target="_blank"><img src="static/elements/logo-udemy.svg" alt="udemy course bootcamp logo certification"/></a>

                <h1 className="radley-regular">
                    The Complete Shopify Dropshipping Course</h1>
                <hr/>

            </div>
            <div className="certification">
                <a href="#"><img src="./src/assets/logo-udemy.svg" alt="udemy course bootcamp logo certification"/></a>
                <h1 className="radley-regular">The Complete Web Development Bootcamp</h1>
                <hr/>

            </div>
        </div>

        <hr/>

        <div className="fifth-div section">
            <div className="background-div">
                <h1 className="radley-regular p-focus">Our Project Focuses</h1>
            </div>
            <div className="field">
                <img src="./src/assets/frontend.jpg" alt="Front-End"/>
                <h1 className="radley-regular">Front-End Developing</h1>
                <hr/>
                <h2 className="carlito-regular">Front-End <span className="carlito-bold">developer</span> in the making. This website is proof of my work.</h2>
            </div>
            <div className="field">
                <img src="./src/assets/Python.png" alt="Python Scripting"/>
                <h1 className="radley-regular">Python Scripting</h1>
                <hr/>
                <h2 className="carlito-regular">Certified Python <span className="carlito-bold">programmer</span> since 2022</h2>
            </div>
            <div className="field">
                <img src="./src/assets/shopify-logo.png" alt="Telegram BOT"/>
                <h1 className="radley-regular">Shopify Store Creation</h1>
                <hr/>
                <h2 className="carlito-regular">Certified Shopify Store <span className="carlito-bold">creator</span> with real-life business experience.</h2>
            </div>
            <div className="field">
                <img src="./src/assets/google_ads.png" alt="Google ads"/>
                <h1 className="radley-regular">Google Ads - Campaigns</h1>
                <hr/>
                <h2 className="carlito-regular">G-ADS <span className="carlito-bold">targeted</span> campaigns expert.</h2>
            </div>
        </div>

        <hr/>

        <div className="sixth-div section">
            <div className="background-div">
                <h1 className="radley-regular">Our Project Gallery</h1>
                <h2 className="carlito-regular">Here are some of the projects we worked on.</h2>
            </div>
            <div className="certification">
                <img src="./src/assets/DMDAILYDEALS.png" alt="Shopify dropshipping store brand"/>
                <h1 className="radley-regular">DMDailyDeals Shopify dropshipping store.</h1>
            </div>
            <div className="certification">
                <img src="./src/assets/telegrambot.png" alt="Python-Telegram web scraping and auto-poster BOT"/>
                <h1 className="radley-regular">Python-Telegram web scraping and auto-poster BOT for <a className="radley-regular" href="https://t.me/cryptocoin_allnews" target="_blank">Bitcoin News Crypto</a> Channel.</h1>
            </div>
        </div>

        <div className="seventh-div section">
            <div className="certification">
                <img src="./src/assets/frontend.jpg" alt="Front-End Personal Website"/>
                <h1 className="radley-regular">This website you are seeing.</h1>
            </div>
            <div className="certification">
                <img src="./src/assets/telegrambot.png" alt="Python-Telegram web scraping and auto-poster BOT"/>
                <h1 className="radley-regular">Python-Telegram web scraping and auto-poster BOT for <a className="radley-regular" href="https://t.me/dmdailydeals" target="_blank">DM Daily</a> Channel.</h1>
            </div>
            <div className="certification">
                <img src="./src/assets/google_ads.png" alt="Google Ads Targeted Keyword Campaigns for dropshipping stores"/>
                <h1 className="radley-regular">Google Ads Targeted Keyword Campaigns for dropshipping stores.</h1>
            </div>
            <div className="certification">
                <img src="./src/assets/Python.png" alt="Medical Blog website with HTML, CSS & Python"/>
                <h1 className="radley-regular">Medical Blog website with HTML, CSS & Python</h1>
            </div>
        </div>

        <div className="eightth-div section"></div>

        <div className="ninth-div section">
            <div className="last-field">
                <h1 className="radley-regular">Reach out if you want to create Python Scripts, Shopify Stores, G-ADS Campaigns or even costum websites together.</h1>
                <hr/>
                <h2 className="carlito-regular">TO SEE MORE OF OUR WORK, VISIT THIS <a href="https://github.com/drdtrn">GitHub</a>.</h2>
                <a href="#" style={{fontSize: '14px'}}>DM Daily Deals LLC © - 2024 - All rights reserved</a>
            </div>
            <div className="contacts">
                <div className="email">
                    <div className="svg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="bi bi-envelope-check-fill" viewBox="0 0 16 16">
                            <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414zM0 4.697v7.104l5.803-3.558zM6.761 8.83l-6.57 4.026A2 2 0 0 0 2 14h6.256A4.5 4.5 0 0 1 8 12.5a4.49 4.49 0 0 1 1.606-3.446l-.367-.225L8 9.586zM16 4.697v4.974A4.5 4.5 0 0 0 12.5 8a4.5 4.5 0 0 0-1.965.45l-.338-.207z"/>
                            <path d="M16 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0m-1.993-1.679a.5.5 0 0 0-.686.172l-1.17 1.95-.547-.547a.5.5 0 0 0-.708.708l.774.773a.75.75 0 0 0 1.174-.144l1.335-2.226a.5.5 0 0 0-.172-.686"/>
                        </svg>
                    </div>
                    <div className="details">
                        <h2 className="carlito-regular">EMAIL</h2>
                        <h2 className="radley-regular">info@dmdailydeals.com</h2>
                    </div>
                </div>
                <div className="phone">
                    <div className="svg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="bi bi-chat-quote-fill" viewBox="0 0 16 16">
                            <path d="M16 8c0 3.866-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.584.296-1.925.864-4.181 1.234-.2.032-.352-.176-.273-.362.354-.836.674-1.95.77-2.966C.744 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7M7.194 6.766a1.7 1.7 0 0 0-.227-.272 1.5 1.5 0 0 0-.469-.324l-.008-.004A1.8 1.8 0 0 0 5.734 6C4.776 6 4 6.746 4 7.667c0 .92.776 1.666 1.734 1.666.343 0 .662-.095.931-.26-.137.389-.39.804-.81 1.22a.405.405 0 0 0 .011.59c.173.16.447.155.614-.01 1.334-1.329 1.37-2.758.941-3.706a2.5 2.5 0 0 0-.227-.4zM11 9.073c-.136.389-.39.804-.81 1.22a.405.405 0 0 0 .012.59c.172.16.446.155.613-.01 1.334-1.329 1.37-2.758.942-3.706a2.5 2.5 0 0 0-.228-.4 1.7 1.7 0 0 0-.227-.273 1.5 1.5 0 0 0-.469-.324l-.008-.004A1.8 1.8 0 0 0 10.07 6c-.957 0-1.734.746-1.734 1.667 0 .92.777 1.666 1.734 1.666.343 0 .662-.095.931-.26z"/>
                        </svg>
                    </div>
                    <div className="details">
                        <h2 className="carlito-regular">WHATSAPP</h2>
                        <h2 className="radley-regular">(+383) 45 264 723</h2>
                    </div>
                </div>
            </div>
        </div>
    </body>
    )
}

export default myCv;