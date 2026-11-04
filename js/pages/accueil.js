/* ============================================================
   PAGE Accueil
   Animations, carrousel et ouverture du parcours.
   Vue : pages/accueil.html
   ============================================================ */

let productivityLevel = 20;
let currentSlide = 0;
let hasAnimated = false;
const totalSlides = 4;

function checkScroll() {
    if (hasAnimated) return;
    
    const section = document.getElementById('beforeAfter');
    const rect = section.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight * 0.75;

    if (isVisible) {
        hasAnimated = true;
        animateMeters();
    }
}

function animateMeters() {
    /* Seule la jauge Après bouge : elle monte de 20 % à 90 %.
       La jauge Avant reste fixe à 75 %. */
    let prodProgress = 20;
    const prodInterval = setInterval(() => {
        prodProgress += 2;
        if (prodProgress >= 90) {
            clearInterval(prodInterval);
            productivityLevel = 90;
            document.getElementById('prodValue').textContent = '90%';
            document.getElementById('prodFill').style.width = '90%';
        } else {
            productivityLevel = prodProgress;
            document.getElementById('prodValue').textContent = prodProgress + '%';
            document.getElementById('prodFill').style.width = prodProgress + '%';
        }
    }, 50);
}

window.addEventListener('scroll', checkScroll);

function updateSlides() {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dot');

    slides.forEach((slide, index) => {
        slide.classList.remove('active', 'prev');
        if (index === currentSlide) {
            slide.classList.add('active');
        } else if (index < currentSlide) {
            slide.classList.add('prev');
        }
    });

    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
}

function nextSlide() {
    currentSlide = (currentSlide + 1) % totalSlides;
    updateSlides();
}

function prevSlide() {
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    updateSlides();
}

function goToSlide(index) {
    currentSlide = index;
    updateSlides();
}

setInterval(nextSlide, 5000);

function openContextModal() {
    document.getElementById('contextModal').classList.add('active');
    setTimeout(() => {
        document.getElementById('nameInput').focus();
    }, 300);
}

function closeContextModal() {
    document.getElementById('contextModal').classList.remove('active');
    document.getElementById('nameInput').value = '';
    document.getElementById('nameError').classList.remove('show');
}
