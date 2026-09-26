document.getElementById('year').textContent = new Date().getFullYear();

const navToggle = document.getElementById('navToggle');
const nav = document.getElementById('nav');
navToggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});
nav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

const form = document.getElementById('contactForm');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const name = data.get('name') || '';
  const business = data.get('business') || '';
  const reachback = data.get('reachback') || '';
  const message = data.get('message') || '';

  const subject = `Enquiry from ${name}${business ? ' (' + business + ')' : ''}`;
  const body =
    `Name: ${name}\n` +
    `Business: ${business}\n` +
    `Reach me at: ${reachback}\n\n` +
    `Message:\n${message}`;

  window.location.href =
    `mailto:republicchow@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
