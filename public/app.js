// House of BB: limited drop stock display and checkout.
document.getElementById('year').textContent = new Date().getFullYear();

// Photo gallery: switch the main image between the tee and the close-up.
const mainImage = document.getElementById('main-image');
document.querySelectorAll('.thumb').forEach((thumb) => {
  thumb.addEventListener('click', () => {
    mainImage.src = thumb.dataset.src;
    mainImage.alt = thumb.dataset.alt;
    mainImage.width = thumb.dataset.w;
    mainImage.height = thumb.dataset.h;
    document.querySelectorAll('.thumb').forEach((t) => t.setAttribute('aria-pressed', String(t === thumb)));
  });
});

// Show "X left" only once stock is this low, so a slow start doesn't show a big unsold number.
const SHOW_REMAINING_AT = 15;

const form = document.getElementById('buy-form');
if (form) {
  const button = document.getElementById('buy-button');
  const msg = document.getElementById('form-msg');
  const badge = document.getElementById('drop-badge');
  const stockLine = document.getElementById('stock-line');
  const endsLine = document.getElementById('drop-ends');
  let closed = false;

  const setInfo = (text, colour = '#13306B') => { msg.style.color = colour; msg.innerHTML = text; };

  function closeDrop(label, note) {
    closed = true;
    badge.textContent = label;
    badge.classList.add('is-sold-out');
    button.textContent = label;
    button.disabled = true;
    button.classList.add('is-sold-out');
    stockLine.hidden = true;
    endsLine.hidden = true;
    form.querySelectorAll('input[name="size"]').forEach((i) => { i.disabled = true; });
    setInfo(note);
  }

  function showStock(s) {
    if (s.limit) badge.textContent = `Limited to ${s.limit} pieces`;
    if (s.endsAt && !s.ended) {
      const d = new Date(s.endsAt);
      endsLine.textContent = `Drop closes ${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
      endsLine.hidden = false;
    }
    if (!s.configured || s.error) return;

    if (s.soldOut) {
      closeDrop('Sold out', `All ${s.limit} pieces have gone. <a href="#newsletter">Sign up</a> to hear about the next drop first.`);
    } else if (s.ended) {
      closeDrop('Drop closed', `This drop has closed and won't be made again. <a href="#newsletter">Sign up</a> for the next one.`);
    } else if (s.remaining > 0 && s.remaining <= SHOW_REMAINING_AT) {
      stockLine.textContent = s.remaining === 1 ? 'Only 1 left' : `Only ${s.remaining} of ${s.limit} left`;
      stockLine.hidden = false;
    } else if (s.allReserved) {
      stockLine.textContent = 'The last pieces are in other baskets. Check back in 30 minutes.';
      stockLine.hidden = false;
    }
  }

  fetch('/api/stock').then((r) => r.json()).then(showStock).catch(() => {});

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (closed) return;
    const size = form.querySelector('input[name="size"]:checked')?.value;
    if (!size) { setInfo('Please choose a size.', '#9B2C2C'); return; }

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
        setInfo('Online checkout opens very soon. <a href="#newsletter">Sign up</a> to hear first.');
      } else if (data.error === 'sold_out') {
        return closeDrop('Sold out', 'All pieces have gone. <a href="#newsletter">Sign up</a> to hear about the next drop first.');
      } else if (data.error === 'drop_ended') {
        return closeDrop('Drop closed', 'This drop has closed. <a href="#newsletter">Sign up</a> for the next one.');
      } else if (data.error === 'all_reserved') {
        setInfo('The last pieces are in other baskets right now. Check back in 30 minutes.');
      } else if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      } else {
        throw new Error(data.error || 'Checkout unavailable');
      }
    } catch (err) {
      setInfo('Sorry, checkout could not open. Please try again in a moment.', '#9B2C2C');
    }
    button.disabled = false;
    button.textContent = 'Buy now';
  });
}
