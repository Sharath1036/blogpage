const express = require('express');
const app = express();
const path = require('path');
const { engine } = require('express-handlebars');
const bodyParser = require('body-parser');
const mysql = require('mysql');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'images')));
app.use(bodyParser.urlencoded({ extended: false }));

app.engine('handlebars', engine({
    defaultLayout: 'main',
}));

app.set('view engine', '.handlebars');
app.set('views', path.join(__dirname, './views'))

app.get('/', (req,res) => {
    res.render('home', {
        title: 'Sharath\'s Blogspot',
        style: 'home.css'
    });
});

app.get('/about', (req,res) => {
    res.render('about', {
        title: 'About',  
        style: 'about.css'
    });
});

app.get('/socials', (req,res) => {
  res.render('socials', {
      title: 'Socials',  
      style: 'about.css'
  });
});


// Routing for sections
app.get('/life', (req,res) => {
  res.render('life', {
    title: 'Life',  
    style: 'home.css'
  });
});

app.get('/cs', (req,res) => {
  res.render('cs', {
    title: 'Computer Science',  
    style: 'home.css'
  });
});

app.get('/professional', (req,res) => {
  res.render('professional', {
    title: 'Professional',  
    style: 'home.css'
  });
});


// Slugs for blogs
app.get("/:slug", (req, res) => {
  const slug = req.params.slug;

  if (slug === "dealing-with-a-stranger") {
    res.render("partials/stranger", {
      style: 'blogs.css'
    });
  } else if (slug === "organize-your-linkedin") {
    res.render("partials/orglinkedin", {
      style: 'blogs.css'
    });  
  } else if (slug === "reactjs-guide") {
    res.render("partials/reactjs", {
      style: 'blogs.css'
    });
  } else if (slug === "artificial-intelligence-roadmap") {
    res.render("partials/airoadmap", {
      style: 'blogs.css'
    });
  } else if (slug === "from-a-community-to-a-startup") {
    res.render("partials/community", {
      style: 'blogs.css'
    });
  } else if (slug === "things-i-let-go-off-in-2023") {
    res.render("partials/letgo", {
      style: 'blogs.css'
    });
  } else if (slug === "effective-resume-tips-for-software-engineers") {
    res.render("partials/resume", {
      style: 'blogs.css'
    });
  } else if (slug === "best-data-science-youtuber") {
    res.render("partials/bestdsyt", {
      style: 'blogs.css'
    });
  } else if (slug === "wish-i-had-this-college-life") {
    res.render("partials/wishIHad", {
      style: 'blogs.css'
    });
  } else if (slug === "first-stadium-game-experience") {
    res.render("partials/firststadium", {
      style: 'blogs.css'
    });
  } else if (slug === "deleting-past-github-commits") {
    res.render("partials/deletecommits", {
      style: 'blogs.css'
    });
  } else if (slug === "2023-unwrapped") {
    res.render("partials/2023unwrapped", {
      style: 'blogs.css'
    });
  } else {
    res.status(404).send("Blog not found");
  }
}); 

app.listen(8080, () =>{
  console.log("Server running on port http://localhost:8080");
  console.log("Server running on your network http://192.168.1.4:8080");
});