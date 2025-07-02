document.addEventListener('DOMContentLoaded', async () => {
  // Загрузка товаров
  const products = await fetch('/api/products').then(res => res.json());
  
  // Загрузка корзины
  let cart = await fetch('/api/cart').then(res => res.json());
  updateCartCount(cart);
  updateProductButtons(cart);

  // Обработчики кнопок
  document.querySelectorAll('.card__btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const productId = parseInt(btn.dataset.id);
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId })
      });
      // Обновляем корзину
      cart = await fetch('/api/cart').then(res => res.json());
      updateCartCount(cart);
      // Получаем новое количество
      const cartItem = cart.find(item => item.product_id === productId);
      const qty = cartItem ? cartItem.quantity : 1;
      // Анимация кнопки
      btn.textContent = `✓ Добавлено`;
      btn.classList.add('added-to-cart');
      btn.classList.remove('added-count');
      setTimeout(() => {
        btn.textContent = `Добавлено ×${qty}`;
        btn.classList.remove('added-to-cart');
        btn.classList.add('added-count');
      }, 1000);
      // После анимации обновить все кнопки (на случай, если корзина изменилась)
      setTimeout(() => updateProductButtons(cart), 1000);
    });
  });

  // Открытие корзины
  document.getElementById('cart-icon')?.addEventListener('click', async (e) => {
    e.preventDefault();
    cart = await fetch('/api/cart').then(res => res.json());
    showCartModal(cart);
    updateProductButtons(cart);
  });

  // Закрытие модалки корзины
  document.querySelector('.close')?.addEventListener('click', () => {
    document.getElementById('cart-modal').style.display = 'none';
  });

  // Открытие модалки заказа
  document.getElementById('checkout-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('cart-modal').style.display = 'none';
    document.getElementById('order-modal').style.display = 'block';
    document.getElementById('order-success').style.display = 'none';
    document.getElementById('order-form').reset();
  });

  // Закрытие модалки заказа
  document.querySelector('.close-order')?.addEventListener('click', () => {
    document.getElementById('order-modal').style.display = 'none';
  });

  // Отправка заказа
  document.getElementById('order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('customer_name').value.trim();
    const phone = document.getElementById('customer_phone').value.trim();
    const address = document.getElementById('customer_address').value.trim();
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: name, customer_phone: phone, customer_address: address })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('order-success').style.display = 'block';
      updateCartCount([]);
      updateProductButtons([]);
      setTimeout(() => {
        document.getElementById('order-modal').style.display = 'none';
      }, 2000);
    } else {
      document.getElementById('order-success').style.display = 'none';
      alert(data.message || 'Ошибка оформления заказа');
    }
  });
});

// Функции работы с интерфейсом
function updateCartCount(cart) {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const counter = document.getElementById('cart-count');
  if (counter) {
    counter.textContent = count;
    counter.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

function updateProductButtons(cart) {
  document.querySelectorAll('.card__btn').forEach(btn => {
    const productId = parseInt(btn.dataset.id);
    const cartItem = cart.find(item => item.product_id === productId);
    btn.classList.remove('added-to-cart');
    if (cartItem) {
      btn.textContent = `Добавлено ×${cartItem.quantity}`;
      btn.classList.add('added-count');
    } else {
      btn.textContent = 'В корзину';
      btn.classList.remove('added-count');
    }
  });
}

function showCartModal(cart) {
  const modal = document.getElementById('cart-modal');
  const itemsContainer = document.getElementById('cart-items');
  
  itemsContainer.innerHTML = cart.length === 0 
    ? '<p>Корзина пуста</p>'
    : cart.map(item => `
        <div class="cart-item">
          <h3>${item.name}</h3>
          <p>${item.price} руб × ${item.quantity}</p>
          <button class="remove-item" onclick="removeItem(${item.id}, ${item.quantity})" title="Убрать одну штуку">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 9V16M11 9V16M15 9V16M3 6H19M5 6V18C5 19.1046 5.89543 20 7 20H15C16.1046 20 17 19.1046 17 18V6M8 6V4C8 2.89543 8.89543 2 10 2H12C13.1046 2 14 2.89543 14 4V6" stroke="#e72848" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      `).join('');

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('cart-total').textContent = `Итого: ${total} руб`;
  modal.style.display = 'block';
}

// Глобальная функция для удаления
window.removeItem = async (id, quantity) => {
  if (quantity > 1) {
    await fetch(`/api/cart/${id}`, { method: 'PATCH' });
  } else {
    await fetch(`/api/cart/${id}`, { method: 'DELETE' });
  }
  const cart = await fetch('/api/cart').then(res => res.json());
  showCartModal(cart);
  updateCartCount(cart);
  updateProductButtons(cart);
};