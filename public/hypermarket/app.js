// ============================================================================
// منطق بوابة إدارة هايبر زايد ماركت (لوحة التحكم المركزية)
// ============================================================================

let currentUser = null;
let isFirstTimeSetup = false;
let allOrders = [];
let allMessages = [];
let allProductsAdmin = [];
let allCategoriesAdmin = [];
let allStaffUsers = [];
let currentOrdersFilter = 'all';
let previousOrdersCount = 0;
let ordersPollInterval = null;

// لضبط المرتجع
let pendingReturnOrderId = null;

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

// -------------------------------------------------------------
// 1. نظام الدخول والتهيئة لأول مرة
// -------------------------------------------------------------
async function checkAuth() {
  if (window.location.protocol === 'file:') {
    const errorBox = document.getElementById('authErrorMessage');
    if (errorBox) {
      errorBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <b>تنبيه:</b> أنت تفتح الصفحة مباشرة كملف محلي (file://).<br>لتشغيل المنصة والسيرفر، اضغط مرتين على ملف <b>تشغيل_الموقع.bat</b> ثم ادخل عبر: <br><a href="http://localhost:3000/admin" style="color:#b32424;font-weight:bold;text-decoration:underline;">http://localhost:3000/admin</a>';
      errorBox.style.display = 'block';
    }
    return;
  }

  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    isFirstTimeSetup = data.isFirstTime;

    const alertBox = document.getElementById('firstTimeAlert');
    const groupFullName = document.getElementById('groupFullName');
    const btnSubmit = document.getElementById('btnAuthSubmit');

    if (isFirstTimeSetup) {
      alertBox.style.display = 'flex';
      groupFullName.style.display = 'block';
      document.getElementById('authFullName').required = true;
      btnSubmit.innerHTML = '<i class="fa-solid fa-crown"></i> تهيئة النظام وإنشاء حساب المدير العام';
    } else {
      alertBox.style.display = 'none';
      groupFullName.style.display = 'none';
      document.getElementById('authFullName').required = false;
      btnSubmit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> تسجيل الدخول';
    }

    // فحص الجلسة المحلية
    const savedUser = sessionStorage.getItem('zayed_staff_user');
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      launchDashboard();
    }
  } catch (err) {
    console.error('Auth status check error:', err);
    const errorBox = document.getElementById('authErrorMessage');
    if (errorBox) {
      errorBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <b>تعذر الاتصال بالسيرفر!</b><br><span style="font-size:0.85rem;font-weight:normal;">تأكد من تشغيل ملف <b>تشغيل_الموقع.bat</b> وترك شاشته السوداء مفتوحة أثناء التصفح.</span>';
      errorBox.style.display = 'block';
    }
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const errorBox = document.getElementById('authErrorMessage');
  errorBox.style.display = 'none';

  if (window.location.protocol === 'file:') {
    errorBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> أنت تفتح الصفحة كملف محلي (file://). يرجى تشغيل السيرفر بالضغط على <b>تشغيل_الموقع.bat</b> ثم فتح الرابط <a href="http://localhost:3000/admin" style="color:#b32424;font-weight:bold;">http://localhost:3000/admin</a>';
    errorBox.style.display = 'block';
    return;
  }

  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value.trim();

  if (isFirstTimeSetup) {
    const fullName = document.getElementById('authFullName').value.trim();
    try {
      const res = await fetch('/api/auth/register-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, fullName })
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        sessionStorage.setItem('zayed_staff_user', JSON.stringify(currentUser));
        launchDashboard();
      } else {
        errorBox.textContent = data.error || 'حدث خطأ في التسجيل';
        errorBox.style.display = 'block';
      }
    } catch (err) {
      errorBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <b>تعذر الاتصال بالسيرفر!</b> تأكد من تشغيل ملف <b>تشغيل_الموقع.bat</b> وعدم إغلاق شاشته.';
      errorBox.style.display = 'block';
    }
  } else {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        sessionStorage.setItem('zayed_staff_user', JSON.stringify(currentUser));
        launchDashboard();
      } else {
        errorBox.textContent = data.error || 'بيانات الدخول غير صحيحة';
        errorBox.style.display = 'block';
      }
    } catch (err) {
      errorBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <b>تعذر الاتصال بالسيرفر!</b> تأكد من تشغيل ملف <b>تشغيل_الموقع.bat</b> وعدم إغلاق شاشته.';
      errorBox.style.display = 'block';
    }
  }
}

function logout() {
  sessionStorage.removeItem('zayed_staff_user');
  currentUser = null;
  if (ordersPollInterval) clearInterval(ordersPollInterval);
  document.getElementById('dashboardScreen').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';
  checkAuth();
}

// -------------------------------------------------------------
// 2. إطلاق لوحة التحكم وتحديد الصلاحيات
// -------------------------------------------------------------
function launchDashboard() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('dashboardScreen').style.display = 'block';

  // تحديث بيانات الموظف في الهيدر
  document.getElementById('loggedUserName').textContent = currentUser.fullName || currentUser.username;
  document.getElementById('loggedUserRole').textContent = currentUser.roleTitle || currentUser.role;

  applyRolePermissions();

  // جلب البيانات الأولية
  fetchOrders();
  fetchMessages();
  fetchProductsAdmin();
  fetchCategoriesAdmin();
  fetchBannersAdmin();
  if (currentUser.role === 'admin') {
    fetchStaffUsers();
    checkEmailStatus(false);
  }

  // بدء التحديث التلقائي للطلبات والرسائل الحية كل 6 ثوانٍ
  if (ordersPollInterval) clearInterval(ordersPollInterval);
  ordersPollInterval = setInterval(() => {
    fetchOrders();
    fetchMessages();
  }, 6000);
}

function applyRolePermissions() {
  const role = currentUser.role; // 'admin' | 'cashier' | 'stock_manager'

  const tabOrders = document.getElementById('tabBtnOrders');
  const tabProducts = document.getElementById('tabBtnProducts');
  const tabReports = document.getElementById('tabBtnReports');
  const tabStaff = document.getElementById('tabBtnStaff');
  const tabMessages = document.getElementById('tabBtnMessages');
  const tabBanners = document.getElementById('tabBtnBanners');

  if (role === 'cashier') {
    // الكاشير يرى الأوردرات ورسائل العملاء
    tabOrders.style.display = 'inline-flex';
    if (tabMessages) tabMessages.style.display = 'inline-flex';
    tabProducts.style.display = 'none';
    tabReports.style.display = 'none';
    tabStaff.style.display = 'none';
    if (tabBanners) tabBanners.style.display = 'none';
    switchTab('orders');
  } else if (role === 'stock_manager') {
    // مسؤول المنتجات والمخزن يرى المنتجات والتفنيط والبانرات
    tabOrders.style.display = 'none';
    if (tabMessages) tabMessages.style.display = 'none';
    tabProducts.style.display = 'inline-flex';
    if (tabBanners) tabBanners.style.display = 'inline-flex';
    tabReports.style.display = 'none';
    tabStaff.style.display = 'none';
    switchTab('products');
  } else {
    // المدير العام يرى كل شيء
    tabOrders.style.display = 'inline-flex';
    if (tabMessages) tabMessages.style.display = 'inline-flex';
    tabProducts.style.display = 'inline-flex';
    if (tabBanners) tabBanners.style.display = 'inline-flex';
    tabReports.style.display = 'inline-flex';
    tabStaff.style.display = 'inline-flex';
    switchTab('orders');
  }
}

function switchTab(tabKey) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

  if (tabKey === 'orders') {
    document.getElementById('tabBtnOrders').classList.add('active');
    document.getElementById('tabContentOrders').classList.add('active');
  } else if (tabKey === 'products') {
    document.getElementById('tabBtnProducts').classList.add('active');
    document.getElementById('tabContentProducts').classList.add('active');
  } else if (tabKey === 'reports') {
    document.getElementById('tabBtnReports').classList.add('active');
    document.getElementById('tabContentReports').classList.add('active');
    renderReportsAndKPIs();
  } else if (tabKey === 'messages') {
    const btnM = document.getElementById('tabBtnMessages');
    const paneM = document.getElementById('tabContentMessages');
    if (btnM) btnM.classList.add('active');
    if (paneM) paneM.classList.add('active');
    fetchMessages();
  } else if (tabKey === 'banners') {
    const btnB = document.getElementById('tabBtnBanners');
    const paneB = document.getElementById('tabContentBanners');
    if (btnB) btnB.classList.add('active');
    if (paneB) paneB.classList.add('active');
    fetchBannersAdmin();
  } else if (tabKey === 'staff') {
    document.getElementById('tabBtnStaff').classList.add('active');
    document.getElementById('tabContentStaff').classList.add('active');
    fetchStaffUsers();
  }
}

// -------------------------------------------------------------
// 3. شاشة الأوردرات الحية وتنبيهات الكاشير والواتساب
// -------------------------------------------------------------
async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    allOrders = await res.json();

    // فحص وصول طلبات جديدة وتشغيل التنبيه الصوتي
    const newOrders = allOrders.filter(o => o.status === 'جديد');
    document.getElementById('liveOrdersBadge').textContent = newOrders.length;

    if (newOrders.length > previousOrdersCount && previousOrdersCount !== 0) {
      playNotificationSound();
    }
    previousOrdersCount = newOrders.length;

    renderOrders();
    updateOrderStatusCounts();
  } catch (err) {
    console.error('Error fetching orders:', err);
  }
}

function playNotificationSound() {
  const toggle = document.getElementById('soundToggle');
  if (toggle && toggle.checked) {
    const audio = document.getElementById('orderNotificationSound');
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => console.log('Audio autoplay prevented'));
    }
  }
}

function updateOrderStatusCounts() {
  document.getElementById('countAll').textContent = allOrders.length;
  document.getElementById('countNew').textContent = allOrders.filter(o => o.status === 'جديد').length;
  document.getElementById('countPrep').textContent = allOrders.filter(o => o.status === 'قيد التجهيز').length;
  document.getElementById('countDelivered').textContent = allOrders.filter(o => o.status === 'تمت').length;
  document.getElementById('countReturned').textContent = allOrders.filter(o => o.status === 'مرتجع').length;
}

function filterOrdersByStatus(status, pillBtn) {
  currentOrdersFilter = status;
  document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  if (pillBtn) pillBtn.classList.add('active');
  renderOrders();
}

function renderOrders() {
  const container = document.getElementById('ordersContainer');
  let filtered = allOrders;

  if (currentOrdersFilter !== 'all') {
    filtered = allOrders.filter(o => o.status === currentOrdersFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: #fff; border-radius: 12px;">
        <i class="fa-solid fa-clipboard-check" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 10px;"></i>
        <h4>لا توجد طلبات في هذا القسم حالياً</h4>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(order => {
    let statusClass = 'status-new';
    let badgeClass = 'status-badge-new';
    if (order.status === 'قيد التجهيز') { statusClass = 'status-prep'; badgeClass = 'status-badge-prep'; }
    else if (order.status === 'تمت') { statusClass = 'status-delivered'; badgeClass = 'status-badge-delivered'; }
    else if (order.status === 'مرتجع') { statusClass = 'status-returned'; badgeClass = 'status-badge-returned'; }

    // تجهيز رابط الواتساب الجاهز متضمناً خانة رسوم التوصيل ليرسلها الكاشير
    const isPickup = order.serviceType === 'pickup';
    const deliveryLine = isPickup 
      ? '🏬 الاستلام من الفرع الرئيسي (شارع المركز - بدون رسوم توصيل)'
      : '🛵 رسوم التوصيل: [اكتب هنا تكلفة التوصيل] جنيه';

    const waText = encodeURIComponent(
      `أهلاً بك يا ${order.customerName} 🛒\n` +
      `تم تأكيد طلبك رقم (${order.id}) من *هايبر زايد ماركت*.\n` +
      `📍 العنوان: ${order.address}\n` +
      `💵 قيمة المنتجات: ${order.subtotal} جنيه\n` +
      `${deliveryLine}\n` +
      `💳 طريقة الدفع: ${order.paymentMethod}\n` +
      `⏱️ التوصيل خلال 45 دقيقة.\nشكراً لتسوقك معنا!`
    );
    const waLink = `https://wa.me/2${order.customerPhone.replace(/^0/, '')}?text=${waText}`;

    return `
      <div class="order-card ${statusClass}">
        <div class="order-card-header">
          <div>
            <span class="order-id-tag">#${order.id}</span>
            <div style="font-size: 0.75rem; color: #64748b;">${order.date}</div>
          </div>
          <span class="order-status-badge ${badgeClass}">${order.status}</span>
        </div>

        <div class="order-customer-info">
          <p><strong><i class="fa-solid fa-user"></i> ${order.customerName}</strong></p>
          <p><i class="fa-solid fa-phone"></i> ${order.customerPhone}</p>
          <p><i class="fa-solid fa-location-dot"></i> ${order.address}</p>
          <p><i class="fa-solid fa-credit-card"></i> طريقة الدفع: <strong>${order.paymentMethod}</strong> ${order.paymentDetails ? `(${order.paymentDetails})` : ''}</p>
          ${order.notes ? `<p style="color: #ea580c;"><i class="fa-solid fa-comment-dots"></i> ملاحظات العميل: ${order.notes}</p>` : ''}
          ${order.returnReason ? `<p style="color: #dc2626; font-weight: bold;"><i class="fa-solid fa-triangle-exclamation"></i> سبب الإرجاع: ${order.returnReason}</p>` : ''}
        </div>

        <div class="order-items-box">
          <strong style="font-size: 0.78rem; color: #475569; display: block; margin-bottom: 6px;">الأصناف المطلوبة:</strong>
          ${(order.items || []).map(i => `
            <div class="order-item-line">
              <span>${i.name} (${i.unit})</span>
              <span>× ${i.quantity} = <strong>${i.price * i.quantity} ج</strong></span>
            </div>
          `).join('')}
        </div>

        <div class="order-financials">
          <span>قيمة المنتجات: ${order.subtotal} ج.م</span>
          <span class="order-total-price">المجموع: ${order.subtotal} ج.م ${isPickup ? '' : '<small style="font-size: 0.75rem; color: #0284c7;">(+ التوصيل)</small>'}</span>
        </div>

        <!-- أزرار الإجراءات للكاشير -->
        <div class="order-actions">
          ${order.status === 'جديد' ? `
            <button class="btn-action btn-confirm" onclick="updateOrderStatus('${order.id}', 'قيد التجهيز')">
              <i class="fa-solid fa-circle-check"></i> تأكيد وتجهيز الطلب
            </button>
          ` : ''}

          <!-- زر الواتساب التلقائي المباشر للعميل -->
          <a href="${waLink}" target="_blank" class="btn-action btn-whatsapp" title="مراسلة العميل بالواتساب">
            <i class="fa-brands fa-whatsapp"></i> واتساب العميل
          </a>

          ${order.status !== 'تمت' && order.status !== 'مرتجع' ? `
            <button class="btn-action btn-deliver" onclick="updateOrderStatus('${order.id}', 'تمت')">
              <i class="fa-solid fa-truck-ramp-box"></i> تمت بنجاح
            </button>
            <button class="btn-action btn-return" onclick="openReturnModal('${order.id}')">
              <i class="fa-solid fa-ban"></i> مرتجع
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function updateOrderStatus(orderId, newStatus, returnReason = '') {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        returnReason: returnReason,
        handledBy: currentUser.fullName || currentUser.username
      })
    });
    const data = await res.json();
    if (data.success) {
      fetchOrders();
      if (newStatus === 'قيد التجهيز' && data.whatsappLink) {
        // فتح محادثة الواتساب في نافذة جديدة للتأكيد الفوري
        window.open(data.whatsappLink, '_blank');
      }
    }
  } catch (err) {
    alert('حدث خطأ أثناء تحديث حالة الطلب');
  }
}

// -------------------------------------------------------------
// 4. معالجة طلبات المرتجع مع تدوين السبب
// -------------------------------------------------------------
function openReturnModal(orderId) {
  pendingReturnOrderId = orderId;
  document.getElementById('returnOrderIdLabel').textContent = '#' + orderId;
  document.getElementById('returnReasonModal').classList.add('active');
}

function closeReturnModal() {
  document.getElementById('returnReasonModal').classList.remove('active');
  pendingReturnOrderId = null;
}

function handleReturnPresetChange() {
  const preset = document.getElementById('returnReasonPreset').value;
  const customGroup = document.getElementById('groupCustomReturnReason');
  if (preset === 'أخرى') {
    customGroup.style.display = 'block';
  } else {
    customGroup.style.display = 'none';
  }
}

function confirmReturnOrder() {
  if (!pendingReturnOrderId) return;
  const preset = document.getElementById('returnReasonPreset').value;
  let reason = preset;
  if (preset === 'أخرى') {
    reason = document.getElementById('returnReasonCustom').value.trim() || 'سبب غير محدد';
  }

  updateOrderStatus(pendingReturnOrderId, 'مرتجع', reason);
  closeReturnModal();
}

// -------------------------------------------------------------
// 5. إدارة المنتجات والتفنيط (Stock & Products Manager)
// -------------------------------------------------------------
async function fetchProductsAdmin() {
  try {
    const res = await fetch('/api/products');
    allProductsAdmin = await res.json();
    renderProductsTable();
  } catch (err) {
    console.error('Error fetching admin products:', err);
  }
}

async function fetchCategoriesAdmin() {
  try {
    const res = await fetch('/api/categories');
    allCategoriesAdmin = await res.json();
    populateCategoryDropdown();
    renderAdminCategoriesGrid();
  } catch (err) {
    console.error('Error fetching admin categories:', err);
  }
}

function populateCategoryDropdown() {
  const select = document.getElementById('newProdCategory');
  select.innerHTML = allCategoriesAdmin.map(c => `
    <option value="${c.id}">${c.icon || '🛒'} ${c.name}</option>
  `).join('');
}

function renderProductsTable() {
  const tbody = document.getElementById('productsTableBody');
  if (!allProductsAdmin || allProductsAdmin.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px;">لا توجد منتجات مسجلة</td></tr>`;
    return;
  }

  tbody.innerHTML = allProductsAdmin.map(p => {
    let saleTypeBadge = 'بالقطعة';
    let basePriceText = `${p.price} ج.م`;
    if (p.saleType === 'weight') {
      saleTypeBadge = 'بالوزن أو الجنيه';
      basePriceText = `${p.pricePerKg} ج.م / كجم`;
    } else if (p.saleType === 'egg') {
      saleTypeBadge = 'بيض (بالعدد/الجنيه)';
      basePriceText = `${p.price} ج.م / بيضة`;
    }
    const cat = allCategoriesAdmin.find(c => c.id === p.category);
    const catName = cat ? cat.name : p.category;

    return `
      <tr>
        <td><img src="${p.image}" class="table-img" alt="${p.name}"></td>
        <td><strong>${p.name}</strong></td>
        <td><span class="user-role-badge">${catName}</span></td>
        <td><span class="category-badge" style="font-size: 0.78rem;">${saleTypeBadge}</span></td>
        <td><strong>${basePriceText}</strong></td>
        <td>${p.offerPrice ? `<span style="color: #dc2626; font-weight: bold;">${p.offerPrice} ج.م</span>` : '<span style="color: #94a3b8;">لا يوجد</span>'}</td>
        <td>${p.stock || 100}</td>
        <td>
          <button class="btn-refresh" onclick="quickEditPrice('${p.id}')" title="تعديل السعر"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn-logout" onclick="deleteProduct('${p.id}')" title="حذف" style="width: 32px; height: 32px; font-size: 0.9rem;"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function handleSaleTypeChange() {
  const type = document.getElementById('newProdSaleType').value;
  const label = document.getElementById('labelBasePrice');
  if (type === 'weight') {
    label.innerHTML = 'سعر الكيلو الأساسي (جنيه): <span style="color: #dc2626;">*</span>';
  } else if (type === 'egg') {
    label.innerHTML = 'سعر البيضة الواحدة (جنيه): <span style="color: #dc2626;">*</span>';
  } else {
    label.innerHTML = 'سعر القطعة (جنيه): <span style="color: #dc2626;">*</span>';
  }
}

function openAddProductModal() {
  document.getElementById('addProductModal').classList.add('active');
}

function closeAddProductModal() {
  document.getElementById('addProductModal').classList.remove('active');
}

async function handleNewProductSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('newProdName').value.trim();
  const category = document.getElementById('newProdCategory').value;
  const saleType = document.getElementById('newProdSaleType').value;
  const price = Number(document.getElementById('newProdPrice').value);
  const offerPrice = document.getElementById('newProdOfferPrice').value ? Number(document.getElementById('newProdOfferPrice').value) : null;
  const image = document.getElementById('newProdImage').value.trim() || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80';
  const description = document.getElementById('newProdDesc').value.trim();

  const payload = {
    name,
    category,
    saleType,
    price: saleType === 'piece' ? price : null,
    pricePerKg: saleType === 'weight' ? price : null,
    offerPrice,
    image,
    description,
    allowedWeights: saleType === 'weight' ? [0.25, 0.5, 1, 2] : null
  };

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeAddProductModal();
      document.getElementById('newProductForm').reset();
      fetchProductsAdmin();
      alert('تمت إضافة المنتج بنجاح ونشره في متجر العملاء');
    }
  } catch (err) {
    alert('حدث خطأ أثناء إضافة المنتج');
  }
}

async function quickEditPrice(productId) {
  const prod = allProductsAdmin.find(p => p.id === productId);
  if (!prod) return;

  const isWeight = prod.saleType === 'weight';
  const isEgg = prod.saleType === 'egg';
  const currentPrice = isWeight ? prod.pricePerKg : prod.price;
  const unitName = isWeight ? 'الكيلو' : (isEgg ? 'البيضة' : 'القطعة');
  const newPrice = prompt(`تعديل سعر ${unitName} لمنتج "${prod.name}" (الحالي: ${currentPrice} ج.م):`, currentPrice);

  if (newPrice !== null && !isNaN(newPrice) && Number(newPrice) > 0) {
    const updatePayload = isWeight ? { pricePerKg: Number(newPrice) } : { price: Number(newPrice) };
    try {
      await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
      fetchProductsAdmin();
    } catch (e) {
      alert('تعذر تحديث السعر');
    }
  }
}

async function deleteProduct(productId) {
  if (confirm('هل أنت متأكد من حذف هذا المنتج من الهايبر؟')) {
    try {
      await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      fetchProductsAdmin();
    } catch (e) {
      alert('تعذر الحذف');
    }
  }
}

// -------------------------------------------------------------
// 6. إدارة فئات وأقسام المتجر والرسوم المصورة
// -------------------------------------------------------------
function renderAdminCategoriesGrid() {
  const container = document.getElementById('adminCategoriesContainer');
  const badge = document.getElementById('catTotalBadge');
  if (badge) badge.textContent = allCategoriesAdmin.length;
  if (!container) return;

  if (allCategoriesAdmin.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #94a3b8;">لا توجد فئات حالياً</div>`;
    return;
  }

  container.innerHTML = allCategoriesAdmin.map(c => {
    const prodCount = (allProductsAdmin || []).filter(p => p.category === c.id).length;
    const fallback = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80';
    return `
      <div class="admin-cat-card">
        <div class="admin-cat-thumb-wrap">
          <img src="${c.image || fallback}" alt="${c.name}" class="admin-cat-thumb" onerror="this.src='${fallback}'">
          <div class="admin-cat-icon-badge">${c.icon || '🛍️'}</div>
        </div>
        <div class="admin-cat-body">
          <h4 class="admin-cat-name">${c.name}</h4>
          <p class="admin-cat-desc">${c.description || 'لا يوجد وصف'}</p>
          <span class="admin-cat-count">${prodCount} منتجات بالقسم</span>
        </div>
        <div class="admin-cat-footer">
          <button class="btn-action btn-deliver" style="padding: 4px 10px; font-size: 0.76rem;" onclick="openEditCategoryModal('${c.id}')" title="تعديل الفئة والرسوم">
            <i class="fa-solid fa-pen-to-square"></i> تعديل
          </button>
          <button class="btn-action btn-cancel" style="padding: 4px 8px; font-size: 0.76rem;" onclick="deleteCategoryAdmin('${c.id}')" title="حذف الفئة">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openAddCategoryModal() {
  document.getElementById('newCategoryForm').reset();
  document.getElementById('editCatId').value = '';
  document.getElementById('catModalTitle').textContent = 'إضافة قسم / فئة جديدة';
  document.getElementById('addCategoryModal').classList.add('active');
}

function openEditCategoryModal(catId) {
  const cat = allCategoriesAdmin.find(c => c.id === catId);
  if (!cat) return;

  document.getElementById('editCatId').value = cat.id;
  document.getElementById('newCatName').value = cat.name;
  document.getElementById('newCatIcon').value = cat.icon || '🛒';
  document.getElementById('newCatImage').value = cat.image || '';
  document.getElementById('newCatDesc').value = cat.description || '';
  document.getElementById('catModalTitle').textContent = `تعديل فئة: ${cat.name}`;
  document.getElementById('addCategoryModal').classList.add('active');
}

function closeAddCategoryModal() {
  document.getElementById('addCategoryModal').classList.remove('active');
}

function setCatPreset(name, icon, image, desc) {
  document.getElementById('newCatName').value = name;
  document.getElementById('newCatIcon').value = icon;
  document.getElementById('newCatImage').value = image;
  document.getElementById('newCatDesc').value = desc;
}

async function handleCategorySubmit(e) {
  e.preventDefault();
  const editId = document.getElementById('editCatId').value;
  const name = document.getElementById('newCatName').value.trim();
  const icon = document.getElementById('newCatIcon').value.trim() || '🛒';
  const image = document.getElementById('newCatImage').value.trim();
  const description = document.getElementById('newCatDesc').value.trim();

  const isEdit = !!editId;
  const url = isEdit ? `/api/categories/${editId}` : '/api/categories';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon, image, description })
    });
    const data = await res.json();
    if (data.success) {
      closeAddCategoryModal();
      document.getElementById('newCategoryForm').reset();
      fetchCategoriesAdmin();
      alert(isEdit ? 'تم تحديث الفئة والرسوم بنجاح' : 'تمت إضافة الفئة الجديدة بنجاح');
    } else {
      alert(data.error || 'حدث خطأ أثناء الحفظ');
    }
  } catch (e) {
    alert('تعذر الاتصال بالسيرفر لحفظ الفئة');
  }
}

async function deleteCategoryAdmin(catId) {
  const cat = allCategoriesAdmin.find(c => c.id === catId);
  const catName = cat ? cat.name : 'هذا القسم';
  if (!confirm(`هل أنت متأكد من حذف فئة "${catName}" من المتجر؟`)) return;

  try {
    const res = await fetch(`/api/categories/${catId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      fetchCategoriesAdmin();
      alert('تم حذف الفئة بنجاح');
    } else {
      alert(data.error || 'تعذر الحذف');
    }
  } catch (e) {
    alert('تعذر الاتصال بالسيرفر للحذف');
  }
}

// -------------------------------------------------------------
// 7. التقارير وشيت الإكسيل الأسبوعي
// -------------------------------------------------------------
function renderReportsAndKPIs() {
  const delivered = allOrders.filter(o => o.status === 'تمت');
  const returned = allOrders.filter(o => o.status === 'مرتجع');

  const totalSales = delivered.reduce((sum, o) => sum + o.total, 0);
  const walletsSales = delivered
    .filter(o => o.paymentMethod.includes('فودافون') || o.paymentMethod.includes('إنستاباي'))
    .reduce((sum, o) => sum + o.total, 0);

  document.getElementById('kpiTotalSales').textContent = `${totalSales} ج.م`;
  document.getElementById('kpiDeliveredCount').textContent = `${delivered.length} طلب`;
  document.getElementById('kpiReturnedCount').textContent = `${returned.length} طلب`;
  document.getElementById('kpiWalletsSales').textContent = `${walletsSales} ج.م`;

  // رسم جدول المعاينة لشيت الإكسيل
  const tbody = document.getElementById('excelPreviewTableBody');
  tbody.innerHTML = allOrders.map(o => {
    const itemsSummary = (o.items || []).map(i => `${i.name} (${i.unit})`).join(', ');
    const isReturned = o.status === 'مرتجع';
    return `
      <tr style="${isReturned ? 'background: #fff1f2;' : ''}">
        <td><strong>#${o.id}</strong></td>
        <td>${o.date}</td>
        <td>${o.customerName}</td>
        <td>${o.customerPhone}</td>
        <td>${o.city || 'فرشوط'}</td>
        <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${itemsSummary}</td>
        <td><strong>${o.total} ج.م</strong></td>
        <td>${o.paymentMethod}</td>
        <td>
          <span class="order-status-badge ${isReturned ? 'status-badge-returned' : 'status-badge-delivered'}">
            ${o.status}
          </span>
        </td>
        <td>${o.returnReason || o.notes || '—'}</td>
      </tr>
    `;
  }).join('');
}

// -------------------------------------------------------------
// 8. إدارة حسابات الموظفين والصلاحيات (Admin Only)
// -------------------------------------------------------------
async function fetchStaffUsers() {
  try {
    const res = await fetch('/api/users');
    allStaffUsers = await res.json();
    renderStaffTable();
  } catch (e) {
    console.error('Error fetching staff users:', e);
  }
}

function renderStaffTable() {
  const tbody = document.getElementById('staffTableBody');
  if (!allStaffUsers || allStaffUsers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">لا يوجد موظفون مسجلون</td></tr>`;
    return;
  }

  tbody.innerHTML = allStaffUsers.map(u => {
    const isMainAdmin = u.username === 'admin';
    const isCurrentLoggedIn = currentUser && (currentUser.id === u.id || currentUser.username === u.username);

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${isMainAdmin ? '#fef3c7' : '#e0f2fe'}; color: ${isMainAdmin ? '#b45309' : '#0284c7'}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
              <i class="fa-solid ${isMainAdmin ? 'fa-crown' : 'fa-user-tie'}"></i>
            </div>
            <div>
              <strong style="color: #0f172a; font-size: 0.95rem;">${u.fullName}</strong>
              ${isCurrentLoggedIn ? '<div style="font-size: 0.72rem; color: #16a34a; font-weight: 800;">(حسابك الحالي النشط)</div>' : ''}
            </div>
          </div>
        </td>
        <td><code style="background: #f1f5f9; padding: 3px 8px; border-radius: 6px; font-weight: bold; color: #0284c7;">${u.username}</code></td>
        <td>
          <div style="display: inline-flex; align-items: center; gap: 8px; background: #ffffff; border: 1px solid #cbd5e1; padding: 5px 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
            <span id="pass-mask-${u.id}" style="font-family: monospace; font-size: 1.1rem; letter-spacing: 2px; color: #64748b;">••••••</span>
            <span id="pass-text-${u.id}" style="display: none; font-family: monospace; font-weight: 800; color: #0f172a; font-size: 0.95rem;">${u.password || '—'}</span>
            <button type="button" onclick="togglePasswordVisibility('${u.id}')" title="إظهار / إخفاء كلمة المرور" style="border: none; background: none; color: #475569; cursor: pointer; padding: 2px 4px; font-size: 0.95rem;">
              <i class="fa-solid fa-eye" id="eye-icon-${u.id}"></i>
            </button>
            <button type="button" onclick="copyStaffPassword('${u.password || ''}')" title="نسخ كلمة السر" style="border: none; background: none; color: #475569; cursor: pointer; padding: 2px 4px; font-size: 0.95rem;">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
        </td>
        <td><span class="user-role-badge">${u.roleTitle || u.role}</span></td>
        <td><span style="font-size: 0.82rem; color: #64748b;">${u.createdAt ? u.createdAt.slice(0, 10) : '—'}</span></td>
        <td>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn-refresh" onclick="openResetPasswordModal('${u.id}')" title="تغيير أو إنشاء كلمة سر جديدة" style="padding: 6px 14px; font-size: 0.82rem; font-weight: 800; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 6px; border-radius: 6px;">
              <i class="fa-solid fa-key"></i> تغيير كلمة السر
            </button>
            ${!isMainAdmin ? `
              <button class="btn-logout" onclick="deleteStaffUser('${u.id}', '${u.fullName}')" title="حذف الموظف" style="width: 32px; height: 32px; font-size: 0.88rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddStaffModal() {
  document.getElementById('addStaffModal').classList.add('active');
}

function closeAddStaffModal() {
  document.getElementById('addStaffModal').classList.remove('active');
}

async function handleNewStaffSubmit(e) {
  e.preventDefault();
  const fullName = document.getElementById('newStaffFullName').value.trim();
  const username = document.getElementById('newStaffUsername').value.trim();
  const password = document.getElementById('newStaffPassword').value.trim();
  const role = document.getElementById('newStaffRole').value;

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, username, password, role })
    });
    const data = await res.json();
    if (data.success) {
      closeAddStaffModal();
      document.getElementById('newStaffForm').reset();
      fetchStaffUsers();
      alert(`✅ تم إنشاء حساب الموظف "${fullName}" بنجاح!\n\nاسم الدخول: ${username}\nكلمة المرور: ${password}`);
    } else {
      alert(data.error || 'حدث خطأ أثناء إنشاء حساب الموظف');
    }
  } catch (err) {
    alert('تعذر الاتصال بالسيرفر');
  }
}

// -------------------------------------------------------------
// وظائف تغيير وتعيين كلمة السر للموظف بصلاحيات المدير الكاملة
// -------------------------------------------------------------
function openResetPasswordModal(userId) {
  let targetUser = null;
  if (userId === 'my_account') {
    targetUser = currentUser;
  } else {
    targetUser = allStaffUsers.find(u => u.id === userId);
  }

  if (!targetUser) return;

  document.getElementById('resetTargetUserId').value = targetUser.id;
  document.getElementById('resetTargetFullName').textContent = targetUser.fullName;
  document.getElementById('resetTargetUsername').textContent = targetUser.username;
  document.getElementById('resetTargetRole').textContent = targetUser.roleTitle || targetUser.role;
  document.getElementById('resetNewPasswordInput').value = '';
  document.getElementById('resetPasswordModal').classList.add('active');

  setTimeout(() => {
    document.getElementById('resetNewPasswordInput').focus();
  }, 100);
}

function closeResetPasswordModal() {
  document.getElementById('resetPasswordModal').classList.remove('active');
  document.getElementById('resetPasswordForm').reset();
}

function generateRandomPassword() {
  const words = ['Zayed', 'Khair', 'Nag', 'Farshout', 'Market', 'Hyper'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(100 + Math.random() * 900);
  const generated = `${word}@${num}`;
  const input = document.getElementById('resetNewPasswordInput');
  input.value = generated;
  input.focus();
}

async function handleResetPasswordSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('resetTargetUserId').value;
  const newPassword = document.getElementById('resetNewPasswordInput').value.trim();

  if (!newPassword || newPassword.length < 3) {
    alert('يرجى كتابة كلمة مرور جديدة لا تقل عن 3 أحرف');
    return;
  }

  try {
    const res = await fetch(`/api/users/${userId}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    });
    const data = await res.json();
    if (data.success) {
      closeResetPasswordModal();
      fetchStaffUsers();
      alert(`✅ تم بنجاح تعيين وتحديث كلمة المرور!\n\nاسم الدخول: ${data.username}\nكلمة المرور الجديدة: ${data.newPassword}\n\nتم حفظها في النظام، ويمكن للموظف تسجيل الدخول بها فوراً.`);
    } else {
      alert(data.error || 'تعذر تغيير كلمة المرور');
    }
  } catch (err) {
    alert('تعذر الاتصال بالسيرفر');
  }
}

function togglePasswordVisibility(userId) {
  const mask = document.getElementById(`pass-mask-${userId}`);
  const text = document.getElementById(`pass-text-${userId}`);
  const icon = document.getElementById(`eye-icon-${userId}`);
  if (!mask || !text || !icon) return;

  if (text.style.display === 'none') {
    text.style.display = 'inline';
    mask.style.display = 'none';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    text.style.display = 'none';
    mask.style.display = 'inline';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

function copyStaffPassword(pwd) {
  if (!pwd) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(pwd).then(() => {
      alert(`تم نسخ كلمة المرور: "${pwd}" إلى الحافظة بنجاح 📋`);
    }).catch(() => {
      prompt('انسخ كلمة المرور:', pwd);
    });
  } else {
    prompt('انسخ كلمة المرور:', pwd);
  }
}

async function deleteStaffUser(userId, userName) {
  if (!confirm(`هل أنت متأكد من حذف حساب الموظف "${userName}" نهائياً من النظام؟`)) {
    return;
  }
  try {
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      fetchStaffUsers();
      alert('تم حذف حساب الموظف بنجاح');
    } else {
      alert(data.error || 'تعذر حذف الموظف');
    }
  } catch (err) {
    alert('تعذر الاتصال بالسيرفر');
  }
}

// -------------------------------------------------------------
// 9. إدارة رسائل واستفسارات تواصل معنا
// -------------------------------------------------------------
async function fetchMessages() {
  try {
    const res = await fetch('/api/messages');
    allMessages = await res.json();

    const newMsgs = allMessages.filter(m => m.status === 'جديد');
    const badge = document.getElementById('liveMessagesBadge');
    if (badge) badge.textContent = newMsgs.length;

    renderMessagesTable();
  } catch (err) {
    console.error('Error fetching messages:', err);
  }
}

function renderMessagesTable() {
  const tbody = document.getElementById('messagesTableBody');
  if (!tbody) return;

  if (!allMessages || allMessages.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 25px; color: #64748b;">لا توجد رسائل واردة من العملاء حتى الآن</td></tr>`;
    return;
  }

  const empCode = currentUser ? (currentUser.username || currentUser.id) : '101';
  const empName = currentUser ? (currentUser.fullName || currentUser.username) : 'خدمة العملاء';

  tbody.innerHTML = allMessages.map(msg => {
    const isNew = msg.status === 'جديد';
    
    // رسالة الواتساب متضمنة كود واسم الموظف المسجل على السيستم
    const waReplyText = encodeURIComponent(
      `أهلاً بك يا ${msg.name} 🌹\n` +
      `معك: ${empName} (كود الموظف: ${empCode})\n` +
      `من فريق خدمة عملاء *هايبر زايد ماركت*.\n` +
      `بخصوص استفسارك عن (${msg.subject}):\n` +
      `[اكتب ردك هنا على رسالة العميل...] \n` +
      `نسعد بخدمتك دائماً! ❤️`
    );
    const waLink = `https://wa.me/2${msg.phone.replace(/^0/, '')}?text=${waReplyText}`;

    return `
      <tr style="${isNew ? 'background: #f0fdf4;' : ''}">
        <td><strong>#${msg.id}</strong></td>
        <td><small>${msg.date}</small></td>
        <td><strong>${msg.name}</strong></td>
        <td><a href="tel:${msg.phone}" style="color: #0284c7; text-decoration: none; font-weight: bold;">${msg.phone}</a></td>
        <td><span class="user-role-badge" style="background: #fef3c7; color: #92400e;">${msg.subject}</span></td>
        <td style="max-width: 250px; font-size: 0.85rem;">${msg.message}</td>
        <td>
          <span class="order-status-badge ${isNew ? 'status-badge-new' : 'status-badge-delivered'}">
            ${msg.status}
          </span>
        </td>
        <td>
          <small style="color: #0f172a; font-weight: 700;">
            ${msg.handledBy ? `<i class="fa-solid fa-user-check text-success"></i> ${msg.handledBy}` : '<span style="color: #94a3b8;">قيد الانتظار</span>'}
          </small>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <a href="${waLink}" target="_blank" class="btn-action btn-whatsapp" style="padding: 6px 10px;" onclick="markMessageReplied('${msg.id}')" title="رد عبر الواتساب بكود الموظف">
              <i class="fa-brands fa-whatsapp"></i> رد واتساب
            </a>
            ${isNew ? `
              <button class="btn-action btn-deliver" style="padding: 6px 10px;" onclick="markMessageReplied('${msg.id}')" title="تحديد كـ تم الرد">
                <i class="fa-solid fa-check"></i> تم الرد
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function markMessageReplied(msgId) {
  const empCode = currentUser ? `${currentUser.fullName} (كود: ${currentUser.username})` : 'المدير العام';
  try {
    const res = await fetch(`/api/messages/${msgId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'تم الرد',
        handledBy: empCode
      })
    });
    const data = await res.json();
    if (data.success) {
      fetchMessages();
    }
  } catch (e) {
    console.error('Error marking message as replied:', e);
  }
}

// -------------------------------------------------------------
// فحص حالة خدمة إرسال إيميلات التنشيط عبر جوجل
// -------------------------------------------------------------
async function checkEmailStatus(showToast = false) {
  const badge = document.getElementById('emailStatusBadge');
  const desc = document.getElementById('emailStatusDesc');
  const iconCircle = document.getElementById('emailStatusIconCircle');
  if (!badge) return;

  try {
    const res = await fetch('/api/admin/email-status');
    const data = await res.json();

    if (data.isConfigured) {
      badge.textContent = 'مفعلة وتعمل عبر Google SMTP بنجاح';
      badge.style.background = '#dcfce7';
      badge.style.color = '#15803d';

      if (iconCircle) {
        iconCircle.style.background = '#dcfce7';
        iconCircle.style.color = '#16a34a';
        iconCircle.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
      }

      desc.innerHTML = `
        مرسل الرسائل الحالي: <strong style="color: #166534;">${data.email}</strong> 
        (${data.senderName}) | يتم إرسال كود التفعيل أوتوماتيكياً لصندوق وارد الجيميل للعميل.
      `;

      if (showToast) {
        alert('خدمة إرسال إيميلات التنشيط عبر جوجل مفعلة وجاهزة للإرسال بنجاح!');
      }
    } else {
      badge.textContent = 'قيد الانتظار (وضع التجربة السريع)';
      badge.style.background = '#fef3c7';
      badge.style.color = '#92400e';

      if (iconCircle) {
        iconCircle.style.background = '#fef3c7';
        iconCircle.style.color = '#d97706';
        iconCircle.innerHTML = '<i class="fa-solid fa-envelope-open-text"></i>';
      }

      desc.innerHTML = `
        ملف الإعدادات: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #0f172a;">${data.configPath || 'إعدادات_البريد/بيانات_الجيميل.txt'}</code> 
        (يمكنك فتح هذا الملف وكتابة إيميل الهايبر وكلمة مرور التطبيقات لتفعيل الإرسال الحقيقي).
      `;

      if (showToast) {
        alert('بيانات الجيميل لم تُسجل بعد في ملف: إعدادات_البريد/بيانات_الجيميل.txt\nالنظام حالياً في وضع التجربة السريع.');
      }
    }
  } catch (err) {
    console.error('Error checking email status:', err);
  }
}

// =============================================================
// 7. إدارة شرائح العروض والبانرات (Slideshow Manager)
// =============================================================
let adminBanners = [];
let adminBannerSettings = { intervalSeconds: 3, autoplay: true };

async function fetchBannersAdmin() {
  const container = document.getElementById('adminBannersContainer');
  const select = document.getElementById('bannerIntervalSelect');
  if (!container) return;

  try {
    const res = await fetch('/api/banners');
    const data = await res.json();
    if (data.success) {
      adminBanners = data.banners || [];
      adminBannerSettings = data.settings || { intervalSeconds: 3, autoplay: true };

      if (select) {
        select.value = adminBannerSettings.intervalSeconds || 3;
      }

      renderAdminBanners();
    }
  } catch (err) {
    console.error('Error fetching admin banners:', err);
  }
}

function renderAdminBanners() {
  const container = document.getElementById('adminBannersContainer');
  if (!container) return;

  if (adminBanners.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: #fff; border-radius: 12px; border: 1px dashed #cbd5e1;">
        <i class="fa-solid fa-images" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 10px;"></i>
        <h4 style="color: #475569; margin: 0 0 6px 0;">لا توجد شرائح حالياً في الصفحة الرئيسية</h4>
        <p style="color: #64748b; font-size: 0.88rem; margin: 0 0 16px 0;">أضف بعض الصور المستطيلة والعروض لتظهر في المستطيل الأخضر لمتجر العملاء</p>
        <button class="btn-primary" onclick="openAddBannerModal()"><i class="fa-solid fa-plus"></i> إضافة أول شريحة</button>
      </div>
    `;
    return;
  }

  container.innerHTML = adminBanners.map(b => `
    <div class="admin-banner-card">
      <div class="admin-banner-img-wrap">
        <img src="${b.image}" alt="${b.title}" class="admin-banner-img" onerror="this.src='https://via.placeholder.com/600x300?text=صورة+غير+متاحة'">
        ${b.badge ? `<span class="admin-banner-badge">${b.badge}</span>` : ''}
      </div>
      <div class="admin-banner-body">
        <h4 class="admin-banner-title">${b.title || 'شريحة بدون عنوان'}</h4>
        <p class="admin-banner-sub">${b.subtitle || 'لا يوجد وصف فرعي'}</p>
        <div style="font-size: 0.8rem; color: #0f766e; background: #f0fdfa; padding: 4px 8px; border-radius: 6px; align-self: flex-start;">
          <i class="fa-solid fa-link"></i> القسم المرتبط: <strong>${getCategoryName(b.linkCategory)}</strong>
        </div>
      </div>
      <div class="admin-banner-footer">
        <span style="font-size: 0.75rem; color: #94a3b8;"><i class="fa-regular fa-clock"></i> نشط في المعرض</span>
        <button class="btn-action btn-cancel" onclick="deleteBanner('${b.id}')" title="حذف الشريحة">
          <i class="fa-solid fa-trash"></i> حذف
        </button>
      </div>
    </div>
  `).join('');
}

function getCategoryName(catId) {
  if (!catId || catId === 'all') return 'جميع الأقسام';
  const found = allCategoriesAdmin.find(c => c.id === catId);
  return found ? found.name : catId;
}

function openAddBannerModal() {
  document.getElementById('addBannerForm').reset();
  document.getElementById('addBannerModal').classList.add('active');
}

function closeAddBannerModal() {
  document.getElementById('addBannerModal').classList.remove('active');
}

function setPresetBannerImg(url, title, subtitle, badge, cat) {
  document.getElementById('bannerImageUrl').value = url;
  document.getElementById('bannerTitle').value = title;
  document.getElementById('bannerSubtitle').value = subtitle;
  document.getElementById('bannerBadge').value = badge;
  document.getElementById('bannerLinkCategory').value = cat || 'all';
}

async function handleAddBannerSubmit(e) {
  e.preventDefault();
  const image = document.getElementById('bannerImageUrl').value.trim();
  const title = document.getElementById('bannerTitle').value.trim();
  const subtitle = document.getElementById('bannerSubtitle').value.trim();
  const badge = document.getElementById('bannerBadge').value.trim();
  const linkCategory = document.getElementById('bannerLinkCategory').value;

  if (!image) {
    alert('يرجى إدخال رابط الصورة');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const origText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';

  try {
    const res = await fetch('/api/banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, title, subtitle, badge, linkCategory })
    });
    const data = await res.json();
    if (data.success) {
      closeAddBannerModal();
      fetchBannersAdmin();
      alert('تمت إضافة الشريحة بنجاح وستظهر فوراً في الصفحة الرئيسية!');
    } else {
      alert(data.error || 'حدث خطأ أثناء إضافة الشريحة');
    }
  } catch (err) {
    alert('تعذر الاتصال بالسيرفر لحفظ الشريحة');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = origText;
  }
}

async function deleteBanner(bannerId) {
  if (!confirm('هل أنت متأكد من حذف هذه الشريحة من الصفحة الرئيسية؟')) return;

  try {
    const res = await fetch(`/api/banners/${bannerId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      fetchBannersAdmin();
    } else {
      alert(data.error || 'حدث خطأ أثناء الحذف');
    }
  } catch (err) {
    alert('تعذر الاتصال بالسيرفر لحذف الشريحة');
  }
}

async function updateBannerInterval() {
  const select = document.getElementById('bannerIntervalSelect');
  const intervalSeconds = parseInt(select.value, 10) || 3;

  try {
    const res = await fetch('/api/banners/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervalSeconds })
    });
    const data = await res.json();
    if (data.success) {
      alert(`تم تحديث سرعة الشرائح بنجاح! سيتم التبديل كل (${intervalSeconds}) ثواني في متجر العملاء.`);
    }
  } catch (err) {
    alert('تعذر الاتصال بالسيرفر لتحديث السرعة');
  }
}
