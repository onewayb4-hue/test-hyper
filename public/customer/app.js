// ============================================================================
// منطق تطبيق متجر العملاء - هايبر زايد ماركت
// ============================================================================

let currentSettings = {};
let allCategories = [];
let allProducts = [];
let currentCategory = 'all';
let isOffersOnly = false;
let currentServiceType = 'delivery'; // 'delivery' أو 'pickup'

// بيانات الموقع المختار (الافتراضي نجع حمادي)
let currentLocation = {
  city: 'نجع حمادي',
  area: 'شارع المركز (الفرع الرئيسي)',
  street: '',
  deliveryFee: 0
};

// سلة المشتريات
let cart = [];

// نطاق التوصيل: نجع حمادي وفرشوط فقط
const CITIES_AREAS = {
  'نجع حمادي': {
    areas: [
      'شارع المركز (بجوار مركز الشرطة)',
      'شرق السكة',
      'غرب السكة',
      'شارع 30',
      'الساحل',
      'حي اللواء',
      'بين المحطات',
      'مدينة الألومنيوم',
      'بهجورة',
      'أولاد نجم',
      'هوّ',
      'الرحمانية',
      'قرى مركز نجع حمادي'
    ]
  },
  'فرشوط': {
    areas: [
      'وسط البلد',
      'ميدان المحطة',
      'شارع الجمهورية',
      'خور الحليمي (بجوار قطونيل)',
      'حي النادي',
      'كوم البيجا',
      'العركي',
      'الدهسة',
      'نجع القاضي',
      'قرى مركز فرشوط'
    ]
  }
};

// عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.protocol === 'file:') {
    const warning = document.createElement('div');
    warning.style.cssText = 'background:#b32424;color:#fff;padding:12px;text-align:center;font-weight:bold;position:sticky;top:0;z-index:999999;box-shadow:0 2px 10px rgba(0,0,0,0.3);';
    warning.innerHTML = '⚠️ تنبيه: أنت تفتح الموقع كملف محلي (file://). لكي يعمل النظام والسيرفر بشكل كامل، يرجى تشغيل ملف <b>تشغيل_الموقع.bat</b> ثم فتح الرابط: <a href="http://localhost:3000/" style="color:#ffeb3b;text-decoration:underline;margin:0 6px;">http://localhost:3000/</a>';
    document.body.prepend(warning);
  }
  loadLocation();
  loadCurrentCustomer();
  fetchSettings();
  fetchCategories();
  fetchProducts();
  fetchBanners();
  initMobileScrollBehavior();

  // إعداد مستمعين الأحداث
  document.getElementById('openLocationModalBtn').addEventListener('click', () => {
    openLocationModal();
  });
});

// مراقبة التمرير على الموبايل لإظهار شريط التنقل (هايبر زايد، الموقع، الاستلام/التوصيل) عند النزول وإخفائه عند الرجوع للأعلى
function initMobileScrollBehavior() {
  let ticking = false;

  function updateMobileScroll() {
    const currentScrollY = window.scrollY || window.pageYOffset;
    if (window.innerWidth <= 768) {
      // إظهار الشريط عند النزول لأكثر من 65 بكسل وإخفاؤه تماماً عند البقاء بالأعلى
      if (currentScrollY > 65) {
        document.body.classList.add('mobile-scrolled');
      } else {
        document.body.classList.remove('mobile-scrolled');
      }
    } else {
      document.body.classList.remove('mobile-scrolled');
    }
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateMobileScroll);
      ticking = true;
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateMobileScroll);
      ticking = true;
    }
  });

  updateMobileScroll();
}

// =============================================================
// إدارة عرض الشرائح والبانرات المتحركة (Slideshow)
// =============================================================
let allBanners = [];
let currentSlideIndex = 0;
let bannerTimer = null;
let bannerIntervalMs = 3000;
let bannerAutoplay = true;

async function fetchBanners() {
  try {
    const res = await fetch('/api/banners');
    const data = await res.json();
    if (data.success && Array.isArray(data.banners) && data.banners.length > 0) {
      allBanners = data.banners;
      if (data.settings && data.settings.intervalSeconds) {
        bannerIntervalMs = data.settings.intervalSeconds * 1000;
      }
      bannerAutoplay = data.settings ? data.settings.autoplay !== false : true;
      renderBanners();
      startBannerAutoplay();
    }
  } catch (err) {
    console.error('Error fetching banners:', err);
  }
}

function renderBanners() {
  const track = document.getElementById('heroSliderTrack');
  const dots = document.getElementById('sliderDotsContainer');
  if (!track || allBanners.length === 0) return;

  track.innerHTML = allBanners.map((banner, idx) => `
    <div class="slide-item ${idx === 0 ? 'active' : ''}" 
         onclick="handleSlideClick('${banner.linkCategory || 'all'}')"
         title="${banner.title || 'عرض خاص'}">
      <img src="${banner.image}" alt="${banner.title || 'هايبر زايد'}" class="slide-bg-img" loading="lazy">
      <div class="slide-overlay">
        ${banner.badge ? `<span class="slide-badge">${banner.badge}</span>` : '<div></div>'}
        <div class="slide-caption">
          <h3>${banner.title || ''}</h3>
          ${banner.subtitle ? `<p>${banner.subtitle}</p>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  if (dots) {
    dots.innerHTML = allBanners.map((_, idx) => `
      <button class="slider-dot ${idx === 0 ? 'active' : ''}" 
              onclick="goToSlide(${idx}, event)" 
              aria-label="الانتقال للشريحة ${idx + 1}"></button>
    `).join('');
  }
}

function goToSlide(index, event) {
  if (event) event.stopPropagation();
  if (allBanners.length === 0) return;
  currentSlideIndex = (index + allBanners.length) % allBanners.length;

  const slides = document.querySelectorAll('.hero-slider-track .slide-item');
  slides.forEach((s, idx) => {
    s.classList.toggle('active', idx === currentSlideIndex);
  });

  const dots = document.querySelectorAll('.slider-dots .slider-dot');
  dots.forEach((d, idx) => {
    d.classList.toggle('active', idx === currentSlideIndex);
  });
}

function nextSlide(event) {
  if (event) event.stopPropagation();
  goToSlide(currentSlideIndex + 1);
  if (bannerAutoplay) startBannerAutoplay();
}

function prevSlide(event) {
  if (event) event.stopPropagation();
  goToSlide(currentSlideIndex - 1);
  if (bannerAutoplay) startBannerAutoplay();
}

function startBannerAutoplay() {
  pauseBannerAutoplay();
  if (!bannerAutoplay || allBanners.length <= 1) return;
  bannerTimer = setInterval(() => {
    goToSlide(currentSlideIndex + 1);
  }, bannerIntervalMs);
}

function pauseBannerAutoplay() {
  if (bannerTimer) {
    clearInterval(bannerTimer);
    bannerTimer = null;
  }
}

function resumeBannerAutoplay() {
  if (bannerAutoplay && allBanners.length > 1) {
    startBannerAutoplay();
  }
}

function handleSlideClick(category) {
  if (category && category !== 'none') {
    const pill = document.querySelector(`.cat-pill[onclick*="'${category}'"]`);
    if (pill) {
      pill.click();
    } else {
      selectCategory(category);
    }
    const prodSec = document.querySelector('.products-section');
    if (prodSec) {
      prodSec.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

// -------------------------------------------------------------
// 1. نظام تحديد الموقع الأولي (Location Modal)
// -------------------------------------------------------------
function loadLocation() {
  const saved = localStorage.getItem('zayed_location');
  if (saved) {
    try {
      currentLocation = JSON.parse(saved);
      updateLocationUI();
    } catch (e) {
      openLocationModal();
    }
  } else {
    // فتح نافذة تحديد الموقع فوراً عند أول زيارة للمتجر
    openLocationModal();
  }
}

function openLocationModal() {
  const modal = document.getElementById('locationModal');
  const citySelect = document.getElementById('selectCity');
  citySelect.value = currentLocation.city || 'نجع حمادي';
  handleCityChange();
  modal.classList.add('active');
}

function handleCityChange() {
  const city = document.getElementById('selectCity').value;
  const areaSelect = document.getElementById('selectArea');
  areaSelect.innerHTML = '';

  const cityData = CITIES_AREAS[city] || CITIES_AREAS['نجع حمادي'];
  cityData.areas.forEach(area => {
    const opt = document.createElement('option');
    opt.value = area;
    opt.textContent = area;
    areaSelect.appendChild(opt);
  });

  if (currentLocation.area && city === currentLocation.city) {
    areaSelect.value = currentLocation.area;
  }
}

function handleAutoGPS() {
  if (navigator.geolocation) {
    const btn = document.querySelector('.btn-gps');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري تحديد الإحداثيات...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> تم التحديد عبر GPS (نجع حمادي - قنا)';
        document.getElementById('selectCity').value = 'نجع حمادي';
        handleCityChange();
        document.getElementById('inputStreet').value = 'الموقع التلقائي عبر خرائط GPS';
      },
      (err) => {
        btn.innerHTML = originalText;
        alert('تعذر الوصول للـ GPS، يرجى اختيار المدينة والمنطقة يدوياً.');
      }
    );
  } else {
    alert('متصفحك لا يدعم تحديد الموقع التلقائي، اختر يدويـاً.');
  }
}

function saveLocationAndContinue() {
  const city = document.getElementById('selectCity').value;
  const area = document.getElementById('selectArea').value;
  const street = document.getElementById('inputStreet').value.trim();
  const makeDefault = document.getElementById('checkDefaultAddress').checked;

  currentLocation = {
    city,
    area,
    street,
    deliveryFee: 0
  };

  if (makeDefault) {
    localStorage.setItem('zayed_location', JSON.stringify(currentLocation));
  }

  updateLocationUI();
  document.getElementById('locationModal').classList.remove('active');
}

function updateLocationUI() {
  const badge = document.getElementById('currentLocationBadge');
  badge.textContent = `${currentLocation.city} - ${currentLocation.area || 'الفرع'}`;

  // تحديث خانة العنوان في السلة
  const addressField = document.getElementById('orderAddress');
  if (addressField) {
    addressField.value = `${currentLocation.city}، ${currentLocation.area} ${currentLocation.street ? '، ' + currentLocation.street : ''}`;
  }

  // تحديث رسوم التوصيل بالفاتورة
  updateCartTotals();
}

// -------------------------------------------------------------
// 2. نوع الخدمة (توصيل للمنزل أو استلام من الهايبر)
// -------------------------------------------------------------
function setServiceType(type) {
  currentServiceType = type;
  const btnDel = document.getElementById('btnServiceDelivery');
  const btnPic = document.getElementById('btnServicePickup');
  const addrGroup = document.getElementById('deliveryAddressGroup');
  const rowDel = document.getElementById('rowDeliveryFee');

  if (type === 'delivery') {
    btnDel.classList.add('active');
    btnPic.classList.remove('active');
    if (addrGroup) addrGroup.style.display = 'block';
    if (rowDel) rowDel.style.display = 'flex';
  } else {
    btnDel.classList.remove('active');
    btnPic.classList.add('active');
    if (addrGroup) addrGroup.style.display = 'none';
    if (rowDel) rowDel.style.display = 'none';
  }

  updateCartTotals();
}

// -------------------------------------------------------------
// 3. جلب البيانات من السيرفر (Settings, Categories, Products)
// -------------------------------------------------------------
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    currentSettings = data.settings || {};
  } catch (e) {
    console.error('Error fetching settings:', e);
  }
}

async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
    allCategories = await res.json();
    renderCategories();
  } catch (e) {
    console.error('Error fetching categories:', e);
  }
}

function renderCategories() {
  const container = document.getElementById('categoriesContainer');
  if (!container) return;

  // الحبة الأولى: "منتجات هايبر زايد (جميع الفئات)"
  let html = `
    <button class="cat-pill ${currentCategory === 'all' ? 'active' : ''}" onclick="selectCategory('all', this)">
      <span class="icon">🛒</span>
      <span class="name">منتجات هايبر زايد</span>
    </button>
  `;

  allCategories.forEach(cat => {
    html += `
      <button class="cat-pill ${currentCategory === cat.id ? 'active' : ''}" onclick="selectCategory('${cat.id}', this)">
        <span class="icon">${cat.icon || '🛍️'}</span>
        <span class="name">${cat.name}</span>
      </button>
    `;
  });

  container.innerHTML = html;
  renderSeoudiCategoriesGrid();
}

function openAllCategoriesModal() {
  renderSeoudiCategoriesGrid();
  document.getElementById('allCategoriesModal').classList.add('active');
}

function closeAllCategoriesModal() {
  document.getElementById('allCategoriesModal').classList.remove('active');
}

// توليد شبكة جميع الفئات والرسوم المصورة
function renderSeoudiCategoriesGrid() {
  const grid = document.getElementById('seoudiCategoriesGrid');
  if (!grid) return;

  // الخيار الأول دائماً: منتجات وعروض هايبر زايد
  let cardsHtml = `
    <div class="seoudi-cat-card ${currentCategory === 'all' ? 'active-cat' : ''}" onclick="selectCategoryFromModal('all')">
      <div class="seoudi-cat-img-wrap">
        <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80" alt="منتجات هايبر زايد" class="seoudi-cat-img" loading="lazy">
        <div class="seoudi-cat-badge">🛒</div>
      </div>
      <div class="seoudi-cat-body">
        <div class="seoudi-cat-title-row">
          <h4 class="seoudi-cat-title">منتجات هايبر زايد (جميع الفئات)</h4>
          <i class="fa-solid fa-arrow-left seoudi-cat-arrow"></i>
        </div>
        <p class="seoudi-cat-desc">تصفح كافة الأصناف والمؤن واللحوم والخضار دفعة واحدة</p>
        <span class="seoudi-cat-count">${allProducts.length} صنف متوفر</span>
      </div>
    </div>
  `;

  // باقي الفئات والرسوم المصورة
  allCategories.forEach(cat => {
    const isSelected = currentCategory === cat.id;
    const catProdCount = allProducts.filter(p => p.category === cat.id).length;
    const fallbackImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80';
    const catImg = cat.image || fallbackImg;

    cardsHtml += `
      <div class="seoudi-cat-card ${isSelected ? 'active-cat' : ''}" onclick="selectCategoryFromModal('${cat.id}')">
        <div class="seoudi-cat-img-wrap">
          <img src="${catImg}" alt="${cat.name}" class="seoudi-cat-img" loading="lazy" onerror="this.src='${fallbackImg}'">
          <div class="seoudi-cat-badge">${cat.icon || '🛍️'}</div>
        </div>
        <div class="seoudi-cat-body">
          <div class="seoudi-cat-title-row">
            <h4 class="seoudi-cat-title">${cat.name}</h4>
            <i class="fa-solid fa-arrow-left seoudi-cat-arrow"></i>
          </div>
          <p class="seoudi-cat-desc">${cat.description || 'أجود الأصناف المختارة بعناية يومياً'}</p>
          <span class="seoudi-cat-count">${catProdCount > 0 ? `${catProdCount} أصناف متوفرة` : 'تشكيلة طازجة يومياً'}</span>
        </div>
      </div>
    `;
  });

  grid.innerHTML = cardsHtml;
}

function selectCategoryFromModal(catId) {
  closeAllCategoriesModal();

  const matchingBtn = Array.from(document.querySelectorAll('.cat-pill')).find(btn => {
    return btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${catId}'`);
  });

  selectCategory(catId, matchingBtn);

  // التمرير السلس نحو المنتجات المعروضة
  const prodSec = document.querySelector('.products-section');
  if (prodSec) {
    prodSec.scrollIntoView({ behavior: 'smooth' });
  }
}

function selectCategory(catId, btn) {
  currentCategory = catId;
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  if (btn) {
    btn.classList.add('active');
    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  const catObj = allCategories.find(c => c.id === catId);
  document.getElementById('currentSectionTitle').textContent = catObj ? catObj.name : 'جميع منتجات هايبر زايد';
  document.getElementById('activeFilterTag').textContent = catObj ? catObj.name : 'منتجات هايبر زايد';

  renderSeoudiCategoriesGrid();
  fetchProducts();
}

// -------------------------------------------------------------
// 4. مفتاح تشغيل / إلغاء العروض الحصرية (Offers Toggle)
// -------------------------------------------------------------
function toggleOffersOnly(checked) {
  isOffersOnly = checked;
  const statusText = document.getElementById('offersStatusText');
  const tag = document.getElementById('activeFilterTag');

  if (checked) {
    statusText.innerHTML = '<strong style="color: #f97316;">🔥 مفعل: يتم الآن عرض المنتجات ذات الخصومات فقط</strong>';
    tag.textContent = '🔥 عروض وتخفيضات اليوم';
    tag.style.background = '#ffedd5';
    tag.style.color = '#c2410c';
  } else {
    statusText.textContent = 'اضغط لتصفية المنتجات ذات الأسعار المخفضة فقط';
    tag.textContent = currentCategory === 'all' ? 'كل الأقسام' : 'قسم محدد';
    tag.style.background = '#e2e8f0';
    tag.style.color = '#1e293b';
  }

  fetchProducts();
}

async function fetchProducts() {
  try {
    let url = `/api/products?category=${currentCategory}`;
    if (isOffersOnly) {
      url += '&offersOnly=true';
    }

    const res = await fetch(url);
    allProducts = await res.json();
    renderProducts(allProducts);
    renderSeoudiCategoriesGrid();
  } catch (e) {
    console.error('Error fetching products:', e);
  }
}

function filterProducts() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  if (!query) {
    renderProducts(allProducts);
    return;
  }
  const filtered = allProducts.filter(p =>
    p.name.toLowerCase().includes(query) ||
    (p.description && p.description.toLowerCase().includes(query))
  );
  renderProducts(filtered);
}

// -------------------------------------------------------------
// 5. رسم كروت المنتجات ودعم الشراء المرن (بالوزن، بالجنيه، أو بالعدد)
// -------------------------------------------------------------
// حالة اختيار الشراء لكل منتج (النمط، الوزن المختار، المبلغ بالجنيه، عدد البيض)
const productPurchaseState = {};

function initProductState(productId) {
  if (!productPurchaseState[productId]) {
    const p = allProducts.find(item => item.id === productId);
    const isEgg = p && (p.saleType === 'egg' || (p.name && p.name.includes('بيض')));
    const isWeight = p && p.saleType === 'weight';

    if (isEgg) {
      productPurchaseState[productId] = {
        mode: 'count', // 'count' أو 'money'
        count: 5,
        money: 20
      };
    } else if (isWeight) {
      const allowed = (p && p.allowedWeights) || [0.25, 0.5, 1, 2];
      const defaultW = allowed.includes(0.5) ? 0.5 : (allowed.includes(1) ? 1 : allowed[0] || 0.5);
      productPurchaseState[productId] = {
        mode: 'weight', // 'weight' أو 'money'
        weight: defaultW,
        money: 10
      };
    } else {
      productPurchaseState[productId] = {
        mode: 'piece',
        count: 1
      };
    }
  }
  return productPurchaseState[productId];
}

function calculateProductDisplay(product) {
  const state = initProductState(product.id);
  const isEgg = product.saleType === 'egg' || (product.name && product.name.includes('بيض'));
  const isWeight = product.saleType === 'weight';
  const hasOffer = product.offerPrice && product.offerPrice < (product.price || product.pricePerKg);
  const basePrice = hasOffer ? product.offerPrice : (product.price || product.pricePerKg);
  const originalPrice = product.price || product.pricePerKg;

  let finalPrice = basePrice;
  let oldPrice = null;
  let unitLabel = '/ للقطعة';
  let approxHint = '';

  if (isEgg) {
    if (state.mode === 'count') {
      const count = Math.max(1, state.count || 5);
      finalPrice = Math.round(count * basePrice);
      if (hasOffer) oldPrice = Math.round(count * originalPrice);
      unitLabel = `(${count} ${count > 10 ? 'بيضة' : 'بيضات'})`;
    } else {
      const money = Math.max(1, state.money || 20);
      finalPrice = money;
      const approxCount = Math.round(money / basePrice);
      approxHint = `يعادل حوالي ${approxCount} بيضات تقريباً`;
      unitLabel = `(طلب بـ ${money} ج.م)`;
    }
  } else if (isWeight) {
    if (state.mode === 'weight') {
      const weight = Math.max(0.05, state.weight || 0.5);
      finalPrice = Math.round(weight * basePrice);
      if (hasOffer) oldPrice = Math.round(weight * originalPrice);
      unitLabel = `(لسعر ${formatWeightLabel(weight)})`;
    } else {
      const money = Math.max(1, state.money || 10);
      finalPrice = money;
      const approxKg = money / basePrice;
      if (approxKg < 1) {
        approxHint = `يعادل حوالي ${Math.round(approxKg * 1000)} جرام تقريباً`;
      } else {
        approxHint = `يعادل حوالي ${approxKg.toFixed(2)} كجم تقريباً`;
      }
      unitLabel = `(طلب بـ ${money} ج.م)`;
    }
  } else {
    finalPrice = basePrice;
    if (hasOffer) oldPrice = originalPrice;
    unitLabel = '/ للقطعة';
  }

  return { finalPrice, oldPrice, unitLabel, approxHint };
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  const countText = document.getElementById('productsCountText');

  if (!products || products.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: #fff; border-radius: 12px;">
        <i class="fa-solid fa-box-open" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 12px;"></i>
        <h4>لا توجد أصناف تطابق هذا البحث حالياً</h4>
        <p style="color: #64748b;">جرب إلغاء فلتر العروض أو البحث بكلمة أخرى</p>
      </div>
    `;
    countText.textContent = '0 صنف متوفر';
    return;
  }

  countText.textContent = `${products.length} صنف متاح للشراء`;

  grid.innerHTML = products.map(p => {
    const isEgg = p.saleType === 'egg' || (p.name && p.name.includes('بيض'));
    const isWeight = p.saleType === 'weight';
    const state = initProductState(p.id);

    const hasOffer = p.offerPrice && p.offerPrice < (p.price || p.pricePerKg);
    const activePrice = hasOffer ? p.offerPrice : (p.price || p.pricePerKg);
    const originalPrice = (p.price || p.pricePerKg);

    let discountPercent = 0;
    if (hasOffer) {
      discountPercent = Math.round(((originalPrice - activePrice) / originalPrice) * 100);
    }

    const { finalPrice, oldPrice, unitLabel, approxHint } = calculateProductDisplay(p);

    let controlsHtml = '';
    if (isWeight) {
      const allowed = p.allowedWeights || [0.25, 0.5, 1, 2];
      const isWeightMode = state.mode === 'weight';

      controlsHtml = `
        <div class="product-purchase-mode" id="purchase-box-${p.id}">
          <div class="mode-tabs">
            <button type="button" class="btn-mode-tab ${isWeightMode ? 'active' : ''}" onclick="switchProductMode('${p.id}', 'weight')">
              <i class="fa-solid fa-scale-balanced"></i> بالوزن (كجم)
            </button>
            <button type="button" class="btn-mode-tab ${!isWeightMode ? 'active' : ''}" onclick="switchProductMode('${p.id}', 'money')">
              <i class="fa-solid fa-money-bill-wave"></i> بالجنيه (ج.م)
            </button>
          </div>

          <!-- لوحة الشراء بالوزن المكتوب -->
          <div class="mode-panel mode-panel-weight" id="panel-weight-${p.id}" style="${isWeightMode ? '' : 'display:none;'}">
            <div class="quick-chips">
              ${allowed.map(w => {
                const label = w === 0.25 ? 'ربع كجم' : (w === 0.5 ? 'نصف كجم' : (w === 0.75 ? 'إلا ربع' : `${w} كجم`));
                const isSelected = (state.weight === w) ? 'active' : '';
                return `<button type="button" class="btn-chip ${isSelected}" onclick="setProductWeightChip('${p.id}', ${w})">${label}</button>`;
              }).join('')}
            </div>
            <div class="custom-qty-box">
              <label><i class="fa-solid fa-pen-to-square"></i> اكتب الوزن بنفسك (مثلاً نصف كيلو = 0.5):</label>
              <div class="qty-stepper">
                <button type="button" class="btn-step" onclick="stepProductWeight('${p.id}', -0.25)">-</button>
                <input type="number" id="custom-weight-${p.id}" class="input-custom-qty" value="${state.weight}" min="0.1" max="50" step="0.25" oninput="onCustomWeightChanged('${p.id}')">
                <span class="stepper-unit">كجم</span>
                <button type="button" class="btn-step" onclick="stepProductWeight('${p.id}', 0.25)">+</button>
              </div>
            </div>
          </div>

          <!-- لوحة الشراء بالجنيه المكتوب -->
          <div class="mode-panel mode-panel-money" id="panel-money-${p.id}" style="${!isWeightMode ? '' : 'display:none;'}">
            <div class="quick-chips">
              ${[5, 10, 15, 20, 50].map(m => {
                const isSelected = (state.money === m) ? 'active' : '';
                return `<button type="button" class="btn-chip ${isSelected}" onclick="setProductMoneyChip('${p.id}', ${m})">${m} ج.م</button>`;
              }).join('')}
            </div>
            <div class="custom-qty-box">
              <label><i class="fa-solid fa-pen-to-square"></i> اكتب المبلغ المطلوب (مثلاً 5 جنيه):</label>
              <div class="qty-stepper">
                <button type="button" class="btn-step" onclick="stepProductMoney('${p.id}', -5)">-</button>
                <input type="number" id="custom-money-${p.id}" class="input-custom-qty" value="${state.money}" min="1" max="1000" step="5" oninput="onCustomMoneyChanged('${p.id}')">
                <span class="stepper-unit">ج.م</span>
                <button type="button" class="btn-step" onclick="stepProductMoney('${p.id}', 5)">+</button>
              </div>
            </div>
            <div class="approx-badge" id="approx-badge-${p.id}">
              <i class="fa-solid fa-calculator"></i> ${approxHint || 'حساب الكمية التقديرية'}
            </div>
          </div>
        </div>
      `;
    } else if (isEgg) {
      const isCountMode = state.mode === 'count';

      controlsHtml = `
        <div class="product-purchase-mode" id="purchase-box-${p.id}">
          <div class="mode-tabs">
            <button type="button" class="btn-mode-tab ${isCountMode ? 'active' : ''}" onclick="switchProductMode('${p.id}', 'count')">
              <i class="fa-solid fa-egg"></i> بالعدد
            </button>
            <button type="button" class="btn-mode-tab ${!isCountMode ? 'active' : ''}" onclick="switchProductMode('${p.id}', 'money')">
              <i class="fa-solid fa-money-bill-wave"></i> بالجنيه (ج.م)
            </button>
          </div>

          <!-- لوحة الشراء بالعدد -->
          <div class="mode-panel mode-panel-weight" id="panel-weight-${p.id}" style="${isCountMode ? '' : 'display:none;'}">
            <div class="quick-chips">
              ${[3, 5, 10, 15, 30].map(c => {
                const label = c === 30 ? 'طبق (30)' : `${c} بيضات`;
                const isSelected = (state.count === c) ? 'active' : '';
                return `<button type="button" class="btn-chip ${isSelected}" onclick="setProductEggChip('${p.id}', ${c})">${label}</button>`;
              }).join('')}
            </div>
            <div class="custom-qty-box">
              <label><i class="fa-solid fa-pen-to-square"></i> اكتب عدد البيض المطلوب:</label>
              <div class="qty-stepper">
                <button type="button" class="btn-step" onclick="stepProductEgg('${p.id}', -1)">-</button>
                <input type="number" id="custom-egg-${p.id}" class="input-custom-qty" value="${state.count}" min="1" max="150" step="1" oninput="onCustomEggChanged('${p.id}')">
                <span class="stepper-unit">بيضة</span>
                <button type="button" class="btn-step" onclick="stepProductEgg('${p.id}', 1)">+</button>
              </div>
            </div>
          </div>

          <!-- لوحة الشراء بالجنيه -->
          <div class="mode-panel mode-panel-money" id="panel-money-${p.id}" style="${!isCountMode ? '' : 'display:none;'}">
            <div class="quick-chips">
              ${[10, 15, 20, 30, 50].map(m => {
                const isSelected = (state.money === m) ? 'active' : '';
                return `<button type="button" class="btn-chip ${isSelected}" onclick="setProductMoneyChip('${p.id}', ${m})">${m} ج.م</button>`;
              }).join('')}
            </div>
            <div class="custom-qty-box">
              <label><i class="fa-solid fa-pen-to-square"></i> اكتب المبلغ المطلوب بالجنيه:</label>
              <div class="qty-stepper">
                <button type="button" class="btn-step" onclick="stepProductMoney('${p.id}', -5)">-</button>
                <input type="number" id="custom-money-${p.id}" class="input-custom-qty" value="${state.money}" min="1" max="500" step="5" oninput="onCustomMoneyChanged('${p.id}')">
                <span class="stepper-unit">ج.م</span>
                <button type="button" class="btn-step" onclick="stepProductMoney('${p.id}', 5)">+</button>
              </div>
            </div>
            <div class="approx-badge" id="approx-badge-${p.id}">
              <i class="fa-solid fa-calculator"></i> ${approxHint || 'حساب الكمية التقديرية'}
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="product-card" id="card-${p.id}">
        <button class="btn-fav-toggle ${isProductFavorited(p.id) ? 'active' : ''}" onclick="toggleFavorite('${p.id}', event)" title="حفظ في المفضلة">
          <i class="fa-${isProductFavorited(p.id) ? 'solid' : 'regular'} fa-heart"></i>
        </button>
        ${hasOffer ? `<span class="badge-offer">🔥 خصم ${discountPercent}%</span>` : ''}
        <img src="${p.image}" alt="${p.name}" class="product-image" loading="lazy">
        <div class="product-body">
          <span class="product-category">${getCategoryName(p.category)}</span>
          <h4 class="product-title">${p.name}</h4>
          <p class="product-desc">${p.description || ''}</p>

          ${controlsHtml}

          <div class="price-container">
            <span class="current-price" id="price-display-${p.id}">${finalPrice} ج.م</span>
            <span class="old-price" id="old-price-${p.id}" style="${oldPrice ? '' : 'display:none;'}">${oldPrice || ''} ج.م</span>
            <span class="unit-label" id="unit-label-${p.id}">${unitLabel}</span>
          </div>

          <button class="btn-add-cart" onclick="addToCart('${p.id}')">
            <i class="fa-solid fa-cart-plus"></i> أضف للسلة
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// تبديل نمط الشراء (بالوزن أو بالجنيه أو بالعدد)
function switchProductMode(productId, newMode) {
  const state = initProductState(productId);
  state.mode = newMode;
  updateProductCardDisplay(productId);
}

// اختيار شريحة وزن سريعة
function setProductWeightChip(productId, weight) {
  const state = initProductState(productId);
  state.weight = weight;
  const input = document.getElementById(`custom-weight-${productId}`);
  if (input) input.value = weight;
  updateProductCardDisplay(productId);
}

// اختيار شريحة مبلغ سريعة بالجنيه
function setProductMoneyChip(productId, money) {
  const state = initProductState(productId);
  state.money = money;
  const input = document.getElementById(`custom-money-${productId}`);
  if (input) input.value = money;
  updateProductCardDisplay(productId);
}

// اختيار شريحة عدد بيض سريعة
function setProductEggChip(productId, count) {
  const state = initProductState(productId);
  state.count = count;
  const input = document.getElementById(`custom-egg-${productId}`);
  if (input) input.value = count;
  updateProductCardDisplay(productId);
}

// عند الكتابة اليدوية في خانة الوزن
function onCustomWeightChanged(productId) {
  const input = document.getElementById(`custom-weight-${productId}`);
  if (!input) return;
  const val = parseFloat(input.value);
  const state = initProductState(productId);
  if (!isNaN(val) && val > 0) {
    state.weight = val;
    updateProductCardDisplay(productId, false);
  }
}

// عند الكتابة اليدوية في خانة المبلغ بالجنيه
function onCustomMoneyChanged(productId) {
  const input = document.getElementById(`custom-money-${productId}`);
  if (!input) return;
  const val = parseFloat(input.value);
  const state = initProductState(productId);
  if (!isNaN(val) && val > 0) {
    state.money = val;
    updateProductCardDisplay(productId, false);
  }
}

// عند الكتابة اليدوية في خانة عدد البيض
function onCustomEggChanged(productId) {
  const input = document.getElementById(`custom-egg-${productId}`);
  if (!input) return;
  const val = parseInt(input.value, 10);
  const state = initProductState(productId);
  if (!isNaN(val) && val > 0) {
    state.count = val;
    updateProductCardDisplay(productId, false);
  }
}

// أزرار الزيادة والنقصان (+) و (-) للوزن
function stepProductWeight(productId, delta) {
  const state = initProductState(productId);
  let cur = parseFloat(state.weight) || 0.5;
  cur = Math.max(0.1, Math.round((cur + delta) * 100) / 100);
  state.weight = cur;
  const input = document.getElementById(`custom-weight-${productId}`);
  if (input) input.value = cur;
  updateProductCardDisplay(productId);
}

// أزرار الزيادة والنقصان (+) و (-) للمبلغ بالجنيه
function stepProductMoney(productId, delta) {
  const state = initProductState(productId);
  let cur = parseFloat(state.money) || 10;
  cur = Math.max(1, Math.round(cur + delta));
  state.money = cur;
  const input = document.getElementById(`custom-money-${productId}`);
  if (input) input.value = cur;
  updateProductCardDisplay(productId);
}

// أزرار الزيادة والنقصان (+) و (-) لعدد البيض
function stepProductEgg(productId, delta) {
  const state = initProductState(productId);
  let cur = parseInt(state.count, 10) || 5;
  cur = Math.max(1, cur + delta);
  state.count = cur;
  const input = document.getElementById(`custom-egg-${productId}`);
  if (input) input.value = cur;
  updateProductCardDisplay(productId);
}

// تحديث بيانات وسعر كارت المنتج لحظياً
function updateProductCardDisplay(productId, updateInputs = true) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const card = document.getElementById(`card-${productId}`);
  if (!card) return;

  const state = initProductState(productId);
  const isEgg = product.saleType === 'egg' || (product.name && product.name.includes('بيض'));
  const isWeight = product.saleType === 'weight';

  // تحديث التبويبات النشطة وإظهار/إخفاء اللوحات
  const isPrimaryMode = (isEgg && state.mode === 'count') || (isWeight && state.mode === 'weight');

  const tabWeight = card.querySelector('.btn-mode-tab:first-child');
  const tabMoney = card.querySelector('.btn-mode-tab:last-child');
  if (tabWeight && tabMoney) {
    tabWeight.classList.toggle('active', isPrimaryMode);
    tabMoney.classList.toggle('active', !isPrimaryMode);
  }

  const panelWeight = document.getElementById(`panel-weight-${productId}`);
  const panelMoney = document.getElementById(`panel-money-${productId}`);
  if (panelWeight && panelMoney) {
    panelWeight.style.display = isPrimaryMode ? 'flex' : 'none';
    panelMoney.style.display = !isPrimaryMode ? 'flex' : 'none';
  }

  // تحديث الحسابات والأسعار
  const { finalPrice, oldPrice, unitLabel, approxHint } = calculateProductDisplay(product);

  const priceElem = document.getElementById(`price-display-${productId}`);
  if (priceElem) priceElem.textContent = `${finalPrice} ج.م`;

  const oldPriceElem = document.getElementById(`old-price-${productId}`);
  if (oldPriceElem) {
    if (oldPrice) {
      oldPriceElem.textContent = `${oldPrice} ج.م`;
      oldPriceElem.style.display = 'inline';
    } else {
      oldPriceElem.style.display = 'none';
    }
  }

  const unitElem = document.getElementById(`unit-label-${productId}`);
  if (unitElem) unitElem.textContent = unitLabel;

  const approxElem = document.getElementById(`approx-badge-${productId}`);
  if (approxElem) {
    approxElem.innerHTML = `<i class="fa-solid fa-calculator"></i> ${approxHint || 'حساب الكمية التقديرية'}`;
  }

  // تحديث الأزرار السريعة (Chips)
  if (isWeight) {
    if (panelWeight) {
      panelWeight.querySelectorAll('.btn-chip').forEach(b => {
        b.classList.remove('active');
        const match = b.getAttribute('onclick').match(/[\d.]+/);
        if (match && parseFloat(match[0]) === state.weight) b.classList.add('active');
      });
    }
  } else if (isEgg) {
    if (panelWeight) {
      panelWeight.querySelectorAll('.btn-chip').forEach(b => {
        b.classList.remove('active');
        const match = b.getAttribute('onclick').match(/\d+/);
        if (match && parseInt(match[0], 10) === state.count) b.classList.add('active');
      });
    }
  }

  if (panelMoney) {
    panelMoney.querySelectorAll('.btn-chip').forEach(b => {
      b.classList.remove('active');
      const match = b.getAttribute('onclick').match(/\d+/);
      if (match && parseFloat(match[0]) === state.money) b.classList.add('active');
    });
  }
}

function formatWeightLabel(w) {
  if (w === 0.25) return 'ربع كجم (250 جم)';
  if (w === 0.5) return 'نصف كجم (500 جم)';
  if (w === 0.75) return 'إلا ربع كجم (750 جم)';
  if (w === 1) return '1 كجم';
  if (w === 1.5) return 'كيلو ونصف (1.5 كجم)';
  if (w === 2) return '2 كجم';
  if (w < 1) return `${Math.round(w * 1000)} جرام`;
  return `${w} كجم`;
}

function getCategoryName(catId) {
  const cat = allCategories.find(c => c.id === catId);
  return cat ? cat.name : 'أصناف متنوعة';
}

// -------------------------------------------------------------
// 6. إدارة سلة المشتريات (Cart Logic)
// -------------------------------------------------------------
function addToCart(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const state = initProductState(productId);
  const isEgg = product.saleType === 'egg' || (product.name && product.name.includes('بيض'));
  const isWeight = product.saleType === 'weight';
  const hasOffer = product.offerPrice && product.offerPrice < (product.price || product.pricePerKg);
  const basePrice = hasOffer ? product.offerPrice : (product.price || product.pricePerKg);

  let cartKey = '';
  let unitLabel = '';
  let unitPrice = 0;
  let weightVal = null;
  let moneyVal = null;

  if (isEgg) {
    if (state.mode === 'count') {
      const count = Math.max(1, state.count || 5);
      unitPrice = Math.round(count * basePrice);
      unitLabel = `${count} بيضات`;
      cartKey = `${product.id}_count_${count}`;
    } else {
      const money = Math.max(1, state.money || 20);
      const approxCount = Math.round(money / basePrice);
      unitPrice = money;
      unitLabel = `طلب بـ ${money} ج.م (~ ${approxCount} بيضات)`;
      cartKey = `${product.id}_money_${money}`;
      moneyVal = money;
    }
  } else if (isWeight) {
    if (state.mode === 'weight') {
      const weight = Math.max(0.05, state.weight || 0.5);
      unitPrice = Math.round(weight * basePrice);
      unitLabel = formatWeightLabel(weight);
      cartKey = `${product.id}_weight_${weight}`;
      weightVal = weight;
    } else {
      const money = Math.max(1, state.money || 10);
      const approxKg = money / basePrice;
      const approxText = approxKg < 1 ? `${Math.round(approxKg * 1000)} جم` : `${approxKg.toFixed(2)} كجم`;
      unitPrice = money;
      unitLabel = `طلب بـ ${money} ج.م (~ ${approxText} تقريباً)`;
      cartKey = `${product.id}_money_${money}`;
      moneyVal = money;
    }
  } else {
    unitPrice = basePrice;
    unitLabel = 'قطعة';
    cartKey = `${product.id}_piece_1`;
  }

  // فحص ما إذا كان الصنف بنفس الوزن أو المبلغ موجوداً بالفعل في السلة
  const existing = cart.find(item => item.cartKey === cartKey);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      cartKey,
      productId: product.id,
      name: product.name,
      unit: unitLabel,
      weightValue: weightVal,
      moneyValue: moneyVal,
      unitPrice: unitPrice,
      quantity: 1,
      image: product.image
    });
  }

  updateCartBadge();
  showToastNotification(`تمت إضافة "${product.name}" (${unitLabel}) إلى سلتك بنجاح 🛒`);
}

function updateCartBadge() {
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  document.getElementById('cartCountBadge').textContent = totalCount;
  document.getElementById('cartTotalHeader').textContent = `${subtotal} ج.م`;
}

function toggleCartModal(open) {
  const modal = document.getElementById('cartModal');
  if (open) {
    renderCartDrawer();
    modal.classList.add('active');
  } else {
    modal.classList.remove('active');
  }
}

function renderCartDrawer() {
  const container = document.getElementById('cartItemsList');
  const subtitle = document.getElementById('cartItemsSubtitle');

  if (cart.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 10px; color: #64748b;">
        <i class="fa-solid fa-cart-arrow-down" style="font-size: 2.5rem; margin-bottom: 10px; color: #cbd5e1;"></i>
        <p>سلة مشترياتك فارغة حالياً</p>
        <button class="btn-primary" style="margin-top: 10px; padding: 8px 18px;" onclick="toggleCartModal(false)">ابدأ التسوق الآن</button>
      </div>
    `;
    subtitle.textContent = '0 أصناف مختارة';
    updateCartTotals();
    return;
  }

  subtitle.textContent = `${cart.length} أصناف في السلة`;

  container.innerHTML = cart.map((item, index) => {
    const itemTotal = item.unitPrice * item.quantity;
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <strong>${item.name}</strong>
          <small>${item.unit} • سعر الوحدة: ${item.unitPrice} ج.م</small>
        </div>
        <div class="cart-item-actions">
          <button class="btn-qty" onclick="changeCartQty(${index}, -1)">-</button>
          <span>${item.quantity}</span>
          <button class="btn-qty" onclick="changeCartQty(${index}, 1)">+</button>
        </div>
        <div class="cart-item-price">${itemTotal} ج.م</div>
      </div>
    `;
  }).join('');

  updateCartTotals();
}

function changeCartQty(index, change) {
  if (cart[index]) {
    cart[index].quantity += change;
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
    }
  }
  updateCartBadge();
  renderCartDrawer();
}

function updateCartTotals() {
  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const total = subtotal;

  const subElem = document.getElementById('invoiceSubtotal');
  const totElem = document.getElementById('invoiceTotal');
  const btnTotal = document.getElementById('btnPayTotal');

  if (subElem) subElem.textContent = `${subtotal} ج.م`;
  if (totElem) totElem.textContent = `${total} ج.م`;
  if (btnTotal) btnTotal.textContent = `${total} ج.م`;
}

// -------------------------------------------------------------
// 7. خيارات الدفع وإتمام الطلب (Checkout & WhatsApp)
// -------------------------------------------------------------
function handlePaymentChange(method) {
  const extraBox = document.getElementById('paymentExtraDetails');
  const extraLabel = document.getElementById('paymentExtraLabel');

  if (method === 'vodafone') {
    extraBox.style.display = 'block';
    extraLabel.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> أدخل رقم فودافون كاش الذي قمت بالتحويل منه:';
  } else if (method === 'instapay') {
    extraBox.style.display = 'block';
    extraLabel.innerHTML = '<i class="fa-solid fa-bolt"></i> أدخل كود مرجع التحويل في إنستاباي أو اسم حسابك:';
  } else {
    extraBox.style.display = 'none';
  }
}

async function submitOrder() {
  if (cart.length === 0) {
    alert('السلة فارغة، أضف بعض المنتجات أولاً.');
    return;
  }

  const customerName = document.getElementById('orderCustomerName').value.trim();
  const customerPhone = document.getElementById('orderCustomerPhone').value.trim();
  const address = document.getElementById('orderAddress').value.trim();
  const notes = document.getElementById('orderNotes').value.trim();

  // التحقق من رقم الهاتف كحقل إجباري للتواصل والواتساب
  if (!customerPhone || customerPhone.length < 10) {
    alert('يرجى إدخال رقم هاتف صحيح للتواصل معك عبر الواتساب وتأكيد الأوردر.');
    document.getElementById('orderCustomerPhone').focus();
    return;
  }

  const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked').value;
  const paymentDetails = document.getElementById('paymentDetailsInput') ? document.getElementById('paymentDetailsInput').value.trim() : '';

  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const total = subtotal;

  const orderPayload = {
    customerName: customerName || 'عميل هايبر زايد',
    customerPhone: customerPhone,
    city: currentLocation.city,
    area: currentLocation.area,
    street: currentLocation.street,
    serviceType: currentServiceType,
    address: currentServiceType === 'pickup' ? 'استلام من فرع هايبر زايد (نجع حمادي - شارع المركز)' : address,
    items: cart.map(item => ({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      price: item.unitPrice
    })),
    subtotal: subtotal,
    deliveryFee: 0,
    deliveryFeeNote: 'تحدد بالواتساب حسب العنوان',
    total: total,
    paymentMethod: selectedPayment,
    paymentDetails: paymentDetails,
    notes: notes
  };

  const btn = document.getElementById('btnSubmitOrder');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري إرسال الطلب للهايبر...';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    const result = await res.json();

    if (result.success) {
      // إفراغ السلة
      cart = [];
      updateCartBadge();
      toggleCartModal(false);

      // إظهار شاشة النجاح
      document.getElementById('successOrderId').textContent = `#${result.order.id}`;
      document.getElementById('successDeliveryTime').textContent = result.estimatedTime;
      document.getElementById('successAddress').textContent = result.order.address;
      document.getElementById('successTotal').textContent = `${result.order.total} ج.م`;

      document.getElementById('orderSuccessModal').classList.add('active');
    } else {
      alert('حدث خطأ أثناء إرسال الطلب: ' + (result.error || 'يرجى المحاولة مجدداً'));
    }
  } catch (err) {
    alert('تعذر الاتصال بالسيرفر، تأكد من تشغيل الموقع.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function closeSuccessModal() {
  document.getElementById('orderSuccessModal').classList.remove('active');
}

// تنبيه Toast خفيف وسريع
function showToastNotification(msg) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #111827;
      color: #fff;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 700;
      z-index: 2000;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 10px;
      border-right: 4px solid #16a34a;
      transition: 0.3s;
    `;
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #22c55e;"></i> ${msg}`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
  }, 2500);
}

// -------------------------------------------------------------
// 8. نافذة تواصل معنا المنبثقة
// -------------------------------------------------------------
function openContactModal() {
  document.getElementById('contactModal').classList.add('active');
}

function closeContactModal() {
  document.getElementById('contactModal').classList.remove('active');
}

async function handleContactSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('contactName').value.trim();
  const phone = document.getElementById('contactPhone').value.trim();
  const subject = document.getElementById('contactSubject').value;
  const message = document.getElementById('contactMessage').value.trim();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال للإدارة...';

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, subject, message })
    });
    const data = await res.json();

    if (data.success) {
      closeContactModal();
      document.getElementById('contactForm').reset();
      showToastNotification('تم إرسال رسالتك لإدارة الهايبر بنجاح! وسنتواصل معك قريباً');

      // فتح محادثة الواتساب أيضاً إن رغب العميل
      if (data.whatsappLink) {
        window.open(data.whatsappLink, '_blank');
      }
    } else {
      alert(data.error || 'حدث خطأ أثناء إرسال الرسالة');
    }
  } catch (err) {
    alert('تعذر الاتصال بالسيرفر لإرسال الرسالة');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
  }
}

// =============================================================
// 9. نظام حساب العميل والأقسام الأربعة (الطلبات، المفضلة، العناوين، الإعدادات)
// =============================================================
let currentCustomer = null;

function loadCurrentCustomer() {
  const saved = localStorage.getItem('zayed_customer');
  if (saved) {
    try {
      currentCustomer = JSON.parse(saved);
      updateCustomerUI();
    } catch (e) {
      currentCustomer = null;
    }
  }
}

function updateCustomerUI() {
  const btnLabel = document.getElementById('userBtnLabel');
  if (!btnLabel) return;
  if (currentCustomer) {
    btnLabel.innerHTML = `<i class="fa-solid fa-user-check text-success"></i> ${currentCustomer.name.split(' ')[0]}`;
    // تعبئة البيانات التلقائية في نموذج الدفع
    const nameInput = document.getElementById('orderCustomerName');
    const phoneInput = document.getElementById('orderCustomerPhone');
    if (nameInput && !nameInput.value) nameInput.value = currentCustomer.name;
    if (phoneInput && !phoneInput.value) phoneInput.value = currentCustomer.phone;
  } else {
    btnLabel.textContent = 'حسابي / تسجيل';
  }
  updateSavedBadge();
}

function updateSavedBadge() {
  const badge = document.getElementById('savedCountBadge');
  if (badge) {
    const favs = getCustomerFavorites();
    badge.textContent = favs.length;
  }
}

function getCustomerFavorites() {
  if (currentCustomer && currentCustomer.favorites) {
    return currentCustomer.favorites;
  }
  try {
    return JSON.parse(localStorage.getItem('zayed_guest_favs') || '[]');
  } catch (e) {
    return [];
  }
}

function isProductFavorited(prodId) {
  const favs = getCustomerFavorites();
  return favs.includes(prodId);
}

async function toggleFavorite(prodId, event) {
  if (event) event.stopPropagation();
  let favs = getCustomerFavorites();
  const index = favs.indexOf(prodId);
  const prod = allProducts.find(p => p.id === prodId);
  const prodName = prod ? prod.name : 'المنتج';

  if (index > -1) {
    favs.splice(index, 1);
    showToastNotification(`تمت إزالة "${prodName}" من المنتجات المحفوظة`);
  } else {
    favs.push(prodId);
    showToastNotification(`تم حفظ "${prodName}" في قائمة منتجاتك المفضلة ❤️`);
  }

  if (currentCustomer) {
    currentCustomer.favorites = favs;
    localStorage.setItem('zayed_customer', JSON.stringify(currentCustomer));
    try {
      await fetch('/api/customer/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentCustomer.id, favorites: favs })
      });
    } catch (e) {}
  } else {
    localStorage.setItem('zayed_guest_favs', JSON.stringify(favs));
  }

  updateSavedBadge();
  renderProducts(allProducts);
  renderCustomerFavorites();
}

function openCustomerAuthOrProfile() {
  if (currentCustomer) {
    openCustomerProfileModal();
  } else {
    openCustomerAuthModal();
  }
}

function openCustomerAuthModal() {
  document.getElementById('customerAuthModal').classList.add('active');
}

function closeCustomerAuthModal() {
  document.getElementById('customerAuthModal').classList.remove('active');
}

let pendingRegistrationData = null;

function switchCustAuthMode(mode) {
  const btnLogin = document.getElementById('btnTabCustLogin');
  const btnReg = document.getElementById('btnTabCustRegister');
  const formLogin = document.getElementById('custLoginForm');
  const formReg = document.getElementById('custRegisterForm');
  const formOtp = document.getElementById('custVerifyOtpForm');
  const title = document.getElementById('custAuthTitle');
  const errBox = document.getElementById('custAuthError');
  errBox.style.display = 'none';

  if (formOtp) formOtp.style.display = 'none';

  if (mode === 'login') {
    btnLogin.classList.add('active');
    btnReg.classList.remove('active');
    formLogin.style.display = 'block';
    formReg.style.display = 'none';
    title.textContent = 'تسجيل الدخول لحسابك';
  } else {
    btnLogin.classList.remove('active');
    btnReg.classList.add('active');
    formLogin.style.display = 'none';
    formReg.style.display = 'block';
    title.textContent = 'إنشاء حساب عميل جديد';
  }
}

async function handleCustomerLogin(e) {
  e.preventDefault();
  const identifier = document.getElementById('custLoginIdentifier').value.trim();
  const password = document.getElementById('custLoginPassword').value.trim();
  const errBox = document.getElementById('custAuthError');
  errBox.style.display = 'none';

  try {
    const res = await fetch('/api/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: identifier, password })
    });
    const data = await res.json();
    if (data.success) {
      currentCustomer = data.customer;
      localStorage.setItem('zayed_customer', JSON.stringify(currentCustomer));
      closeCustomerAuthModal();
      updateCustomerUI();
      showToastNotification(`مرحباً بك يا ${currentCustomer.name} في هايبر زايد`);
    } else {
      errBox.textContent = data.error || 'رقم الهاتف أو كلمة المرور غير صحيحة';
      errBox.style.display = 'block';
    }
  } catch (err) {
    errBox.textContent = 'تعذر الاتصال بالسيرفر';
    errBox.style.display = 'block';
  }
}

// الخطوة 1: إرسال كود التأكيد إلى الجيميل
async function handleCustomerSendOtp(e) {
  e.preventDefault();
  const name = document.getElementById('custRegName').value.trim();
  const email = document.getElementById('custRegEmail').value.trim().toLowerCase();
  const phone = document.getElementById('custRegPhone').value.trim();
  const password = document.getElementById('custRegPassword').value.trim();
  const city = document.getElementById('custRegCity').value;
  const street = document.getElementById('custRegStreet').value.trim();
  const errBox = document.getElementById('custAuthError');
  errBox.style.display = 'none';

  if (!email || !email.includes('@')) {
    errBox.textContent = 'يرجى إدخال إيميل جيميل صحيح';
    errBox.style.display = 'block';
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري إرسال الكود للإيميل...';

  pendingRegistrationData = { name, email, phone, password, city, street };

  try {
    const res = await fetch('/api/customer/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pendingRegistrationData)
    });
    const data = await res.json();

    if (data.success) {
      // إخفاء نموذج التسجيل وإظهار نموذج إدخال الكود
      document.getElementById('custRegisterForm').style.display = 'none';
      document.getElementById('custLoginForm').style.display = 'none';
      document.getElementById('custVerifyOtpForm').style.display = 'block';

      document.getElementById('otpSentToEmail').textContent = email;
      document.getElementById('custAuthTitle').textContent = 'تأكيد الحساب وإدخال الكود';

      // إذا تم إرسال الإيميل فعلياً عبر سيرفرات جوجل
      if (data.realEmailSent) {
        document.getElementById('otpDevHelpBox').style.display = 'none';
        showToastNotification(`تم إرسال كود التحقق إلى صندوق الوارد في Gmail (${email}) 📩`);
      } else if (data.devOtpCode) {
        // إذا لم تكتمل بيانات الجيميل بعد في ملف إعدادات البريد، نظهر الكود للتجربة السريعة
        document.getElementById('devOtpDisplay').textContent = data.devOtpCode;
        document.getElementById('otpDevHelpBox').style.display = 'block';
        showToastNotification(`تم توليد كود التحقق: ${data.devOtpCode}`);
      } else {
        document.getElementById('otpDevHelpBox').style.display = 'none';
        showToastNotification(data.message || 'تم إرسال كود التحقق بنجاح');
      }

      document.getElementById('custOtpCodeInput').focus();
    } else {
      errBox.textContent = data.error || 'حدث خطأ أثناء إرسال الكود';
      errBox.style.display = 'block';
    }
  } catch (err) {
    errBox.textContent = 'تعذر الاتصال بالسيرفر لإرسال الكود';
    errBox.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
  }
}

// الخطوة 2: تأكيد الكود وتفعيل الحساب
async function handleCustomerVerifyOtp(e) {
  e.preventDefault();
  const inputCode = document.getElementById('custOtpCodeInput').value.trim();
  const errBox = document.getElementById('custAuthError');
  errBox.style.display = 'none';

  if (!pendingRegistrationData || !pendingRegistrationData.email) {
    errBox.textContent = 'بيانات التسجيل غير مكتملة، يرجى إعادة البدء';
    errBox.style.display = 'block';
    return;
  }

  if (inputCode.length !== 6) {
    errBox.textContent = 'يرجى إدخال كود التحقق المكون من 6 أرقام بالكامل';
    errBox.style.display = 'block';
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري تأكيد الكود وتفعيل الحساب...';

  try {
    const res = await fetch('/api/customer/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: pendingRegistrationData.email,
        code: inputCode
      })
    });
    const data = await res.json();

    if (data.success) {
      currentCustomer = data.customer;
      localStorage.setItem('zayed_customer', JSON.stringify(currentCustomer));
      closeCustomerAuthModal();
      updateCustomerUI();
      showToastNotification(`تم تأكيد حسابك بنجاح! مرحباً بك يا ${currentCustomer.name} في هايبر زايد`);
      pendingRegistrationData = null;
    } else {
      errBox.textContent = data.error || 'كود التحقق غير صحيح، تأكد من الكود المرسل على بريدك';
      errBox.style.display = 'block';
    }
  } catch (err) {
    errBox.textContent = 'تعذر الاتصال بالسيرفر لتأكيد الكود';
    errBox.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
  }
}

function resendOtpCode() {
  if (!pendingRegistrationData) return;
  document.getElementById('custOtpCodeInput').value = '';
  const fakeEvent = {
    preventDefault: () => {},
    target: { querySelector: () => document.createElement('button') }
  };
  handleCustomerSendOtp(fakeEvent);
}

function backToRegisterForm() {
  document.getElementById('custVerifyOtpForm').style.display = 'none';
  document.getElementById('custRegisterForm').style.display = 'block';
  document.getElementById('custAuthTitle').textContent = 'إنشاء حساب عميل جديد';
}

function handleCustomerLogout() {
  if (confirm('هل ترغب في تسجيل الخروج من حسابك؟')) {
    currentCustomer = null;
    localStorage.removeItem('zayed_customer');
    closeCustomerProfileModal();
    updateCustomerUI();
    showToastNotification('تم تسجيل الخروج بنجاح');
  }
}

// -------------------------------------------------------------
// إدارة لوحة حسابي (الطلبات، المفضلة، العناوين، الإعدادات)
// -------------------------------------------------------------
function openCustomerProfileModal() {
  if (!currentCustomer) return openCustomerAuthModal();

  document.getElementById('profUserName').textContent = currentCustomer.name;
  document.getElementById('profUserPhone').textContent = currentCustomer.phone;
  document.getElementById('profEditName').value = currentCustomer.name;
  document.getElementById('profEditPhone').value = currentCustomer.phone;

  switchProfileTab('orders');
  document.getElementById('customerProfileModal').classList.add('active');
}

function closeCustomerProfileModal() {
  document.getElementById('customerProfileModal').classList.remove('active');
}

function switchProfileTab(tab) {
  const tabs = ['orders', 'favorites', 'addresses', 'settings'];
  tabs.forEach(t => {
    const btn = document.getElementById(`profTabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const sec = document.getElementById(`profSection${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.classList.remove('active');
    if (sec) sec.classList.remove('active');
  });

  const activeBtn = document.getElementById(`profTabBtn${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  const activeSec = document.getElementById(`profSection${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  if (activeBtn) activeBtn.classList.add('active');
  if (activeSec) activeSec.classList.add('active');

  if (tab === 'orders') fetchCustomerOrdersHistory();
  if (tab === 'favorites') renderCustomerFavorites();
  if (tab === 'addresses') renderCustomerAddresses();
}

async function fetchCustomerOrdersHistory() {
  const list = document.getElementById('customerOrdersHistoryList');
  if (!currentCustomer) return;
  list.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل سجل طلباتك...</p>';

  try {
    const res = await fetch(`/api/customer/orders?phone=${currentCustomer.phone}`);
    const orders = await res.json();

    if (!orders || orders.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 30px; color: #64748b;">
          <i class="fa-solid fa-bag-shopping" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 8px;"></i>
          <p>ليس لديك أي طلبات سابقة حتى الآن</p>
        </div>
      `;
      return;
    }

    list.innerHTML = orders.map(o => `
      <div class="cust-order-card">
        <div class="cust-order-header">
          <strong>#${o.id}</strong>
          <span class="order-status-badge ${o.status === 'تمت' ? 'status-badge-delivered' : (o.status === 'مرتجع' ? 'status-badge-returned' : 'status-badge-prep')}">
            ${o.status}
          </span>
        </div>
        <div class="cust-order-body">
          <p><i class="fa-solid fa-calendar-day"></i> ${o.date}</p>
          <p><i class="fa-solid fa-location-dot"></i> ${o.address}</p>
          <div style="color: #475569; margin-top: 4px;">
            ${(o.items || []).map(i => `${i.name} (${i.unit} × ${i.quantity})`).join('، ')}
          </div>
        </div>
        <div class="cust-order-footer">
          <span>طريقة الدفع: ${o.paymentMethod}</span>
          <strong style="color: #0d6832; font-size: 1rem;">الإجمالي: ${o.total} ج.م</strong>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p style="color: #dc2626; text-align: center;">تعذر تحميل سجل الطلبات</p>';
  }
}

function renderCustomerFavorites() {
  const container = document.getElementById('customerFavoritesList');
  const favIds = getCustomerFavorites();

  if (!favIds || favIds.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 30px; color: #64748b;">
        <i class="fa-regular fa-heart" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 8px;"></i>
        <p>لم تقم بحفظ أي منتجات في المفضلة بعد</p>
        <small>اضغط على علامة القلب ❤️ في أي منتج لحفظه هنا</small>
      </div>
    `;
    return;
  }

  const favProducts = allProducts.filter(p => favIds.includes(p.id));
  container.innerHTML = favProducts.map(p => `
    <div class="fav-item-card">
      <img src="${p.image}" class="fav-item-img" alt="${p.name}">
      <strong style="font-size: 0.85rem; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">${p.name}</strong>
      <span style="color: #0d6832; font-weight: 800; font-size: 0.9rem; margin-bottom: 6px;">
        ${p.offerPrice || p.price || p.pricePerKg} ج.م
      </span>
      <div style="display: flex; gap: 4px; width: 100%;">
        <button class="btn-primary full-width" style="padding: 5px; font-size: 0.78rem;" onclick="addToCart('${p.id}')">
          <i class="fa-solid fa-cart-plus"></i> شراء
        </button>
        <button class="btn-danger" style="padding: 5px 8px; font-size: 0.78rem;" onclick="toggleFavorite('${p.id}', event)">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function renderCustomerAddresses() {
  const container = document.getElementById('customerAddressesList');
  if (!currentCustomer) return;
  const addresses = currentCustomer.addresses || [];

  if (addresses.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: #64748b; padding: 20px;">لا توجد عناوين محفوظة حالياً</p>`;
    return;
  }

  container.innerHTML = addresses.map((addr, idx) => `
    <div class="cust-addr-card ${addr.isDefault ? 'is-default' : ''}">
      <div>
        <strong><i class="fa-solid fa-house"></i> ${addr.title || 'عنوان إضافي'} ${addr.isDefault ? '<span class="user-role-badge" style="background: #dcfce7; color: #166534; font-size: 0.7rem;">افتراضي</span>' : ''}</strong>
        <p style="font-size: 0.85rem; color: #475569; margin-top: 2px;">
          ${addr.city} - ${addr.area} ${addr.street ? '، ' + addr.street : ''}
        </p>
      </div>
      <div>
        <button class="btn-primary" style="padding: 5px 10px; font-size: 0.78rem;" onclick="useThisAddress(${idx})">
          <i class="fa-solid fa-check"></i> استخدام
        </button>
      </div>
    </div>
  `).join('');
}

function toggleAddAddressForm() {
  const box = document.getElementById('addNewAddressBox');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

async function saveNewCustomerAddress() {
  const title = document.getElementById('newAddrTitle').value.trim() || 'عنوان جديد';
  const city = document.getElementById('newAddrCity').value;
  const area = document.getElementById('newAddrArea').value.trim();
  const street = document.getElementById('newAddrStreet').value.trim();

  if (!area) {
    alert('يرجى كتابة المنطقة');
    return;
  }

  const newAddr = {
    id: 'addr_' + Date.now(),
    title,
    city,
    area,
    street,
    isDefault: false
  };

  if (!currentCustomer.addresses) currentCustomer.addresses = [];
  currentCustomer.addresses.push(newAddr);
  localStorage.setItem('zayed_customer', JSON.stringify(currentCustomer));

  try {
    await fetch('/api/customer/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentCustomer.id, addresses: currentCustomer.addresses })
    });
    toggleAddAddressForm();
    renderCustomerAddresses();
    showToastNotification('تم حفظ العنوان بنجاح');
  } catch (e) {
    alert('تعذر حفظ العنوان');
  }
}

function useThisAddress(index) {
  if (!currentCustomer || !currentCustomer.addresses[index]) return;
  const addr = currentCustomer.addresses[index];
  currentLocation.city = addr.city;
  currentLocation.area = addr.area;
  currentLocation.street = addr.street;
  updateLocationUI();
  closeCustomerProfileModal();
  showToastNotification(`تم تحديد "${addr.title}" كعنوان التوصيل الحالي`);
}

async function handleCustomerUpdateSettings(e) {
  e.preventDefault();
  const name = document.getElementById('profEditName').value.trim();
  const password = document.getElementById('profEditPassword').value.trim();

  const payload = { id: currentCustomer.id, name };
  if (password) payload.password = password;

  try {
    const res = await fetch('/api/customer/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      currentCustomer.name = name;
      localStorage.setItem('zayed_customer', JSON.stringify(currentCustomer));
      updateCustomerUI();
      document.getElementById('profUserName').textContent = name;
      alert('تم تحديث بيانات الحساب بنجاح');
    }
  } catch (err) {
    alert('تعذر تحديث البيانات');
  }
}
