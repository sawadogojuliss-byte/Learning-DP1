/* ============================================================
   PAGE Accueil
   Animations, carrousel et ouverture du parcours.
   Vue : pages/accueil.html
   ============================================================ */

let stressLevel = 30;
let productivityLevel = 20;
let currentSlide = 0;
let hasAnimated = false;
const totalSlides = 4;

function increaseStress() {
    if (stressLevel < 90) {
        stressLevel = Math.min(stressLevel + 15, 90);
        document.getElementById('stressValue').textContent = stressLevel + '%';
        document.getElementById('stressFill').style.width = stressLevel + '%';
    }
}

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
    let stressProgress = 30;
    const stressInterval = setInterval(() => {
        stressProgress += 2;
        if (stressProgress >= 75) {
            clearInterval(stressInterval);
            stressLevel = 75;
            document.getElementById('stressValue').textContent = '75%';
            document.getElementById('stressFill').style.width = '75%';
        } else {
            stressLevel = stressProgress;
            document.getElementById('stressValue').textContent = stressProgress + '%';
            document.getElementById('stressFill').style.width = stressProgress + '%';
        }
    }, 50);

    let prodProgress = 20;
    const prodInterval = setInterval(() => {
        prodProgress += 2;
        if (prodProgress >= 75) {
            clearInterval(prodInterval);
            productivityLevel = 75;
            document.getElementById('prodValue').textContent = '75%';
            document.getElementById('prodFill').style.width = '75%';
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
