import React from 'react';
import './aboutUs.css';

const AboutMe = () => {
  const skills = ['React.js', 'JavaScript', 'CSS3', 'HTML5', 'Node.js', 'Python', 'PostgreSQL', 'Shopify'];
  const education = [
    { degree: 'The Complete Web Development Bootcamp', university: 'Udemy: Become a Full-Stack Web Developer with just ONE course. HTML, CSS, Javascript, Node, React, PostgreSQL by Dr. Angela YU' },
    { degree: '100 Days of Code - Complete Python Pro Development Bootcamp', university: 'Udemy: Master Python by building 100 projects in 100 days. Learn data science, automation, build websites, games and apps! by Dr. Angela YU' },
    { degree: 'The Complete Shopify Dropshipping Course', university: 'Udemy: The Complete Shopify Aliexpress Dropship course by Tim SHARP'}
  ];

  return (
    <div className="about-container">
      <section className="bio-section">
        <h1>About Me</h1>
        <div className="bio-content">
          <img 
            src="/path-to-your-image.jpg" 
            alt="Profile" 
            className="profile-img"
          />
          <div className="bio-text">
            <h2>Hi, I'm Dardan</h2>
            <p>
              A passionate python and web developer. With 3+ years of experience in programming, creating 
              all kinds of useful programs and apps. I love turning complex problems 
              into simple, beautiful, and intuitive solutions.
            </p>
          </div>
        </div>
      </section>

      <section className="skills-section">
        <h2>Technical Skills</h2>
        <div className="skills-grid">
          {skills.map((skill, index) => (
            <div key={index} className="skill-card">
              {skill}
            </div>
          ))}
        </div>
      </section>

      <section className="education-section">
        <h2>Education</h2>
        <ul className="education-list">
          {education.map((item, index) => (
            <li key={index}>
              <h3>{item.degree}</h3>
              <p>{item.university}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default AboutMe;