document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.querySelector('.navbar-burger');
    navbar.addEventListener('click', () => {
        navbar.classList.toggle('is-active');
        document.querySelector("#main-navbar").classList.toggle('is-active');
    });
});