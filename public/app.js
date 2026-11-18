// House of BB — sends the chosen size to the server, which opens Stripe Checkout.
document.getElementById('year').textContent = new Date().getFullYear();

const form = document.getElementById('buy-form');
if (form) {
  const button = document.getElementById('buy-button');
  const msg = document.getElementById('form-msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const size = form.querySelector('input[name="size"]:checked')?.value;
    if (!size) { msg.textContent = 'Please choose a size.'; return; }

    button.disabled = true;
    button.textContent = 'Opening checkout…';
    msg.textContent = '';

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size }),
      });
      const data = await res.json();
      if (data.error === 'not_configured') {
        msg.style.color = '#13306B';
        msg.textContent = 'Online checkout opens very soon. Sign up below to hear first.';
        button.disabled = false;
        button.textContent = 'Buy now';
        return;
      }
      if (!res.ok || !data.url) throw new Error(data.error || 'Checkout unavailable');
      window.location.href = data.url;
    } catch (err) {
      msg.textContent = 'Sorry, checkout could not open. Please try again in a moment.';
      button.disabled = false;
      button.textContent = 'Buy now';
    }
  });
}
