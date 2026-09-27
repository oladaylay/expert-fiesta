// Contact form (index.html only) — opens a pre-filled email, no data is stored or sent anywhere.
const form = document.getElementById('contactForm');
if (form) {
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
}
