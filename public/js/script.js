/* ==========================================================================
   WANDERLUST CLIENT APP SCRIPT
   ========================================================================== */

(() => {
  'use strict';

  // 1. Bootstrap 5 Form Validation
  const forms = document.querySelectorAll('.needs-validation');
  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      form.classList.add('was-validated');
    }, false);
  });

  // 2. Tax Toggle Switch Handler
  const taxToggleSwitch = document.getElementById("taxToggleSwitch");
  if (taxToggleSwitch) {
    taxToggleSwitch.addEventListener("change", () => {
      document.body.classList.toggle("show-tax", taxToggleSwitch.checked);
    });
  }

  // 3. Wishlist Management (MongoDB Database Async Toggle)
  window.toggleWishlist = async (listingId, btnElem) => {
    if (!listingId) return;

    try {
      const response = await fetch(`/wishlist/toggle/${listingId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      });

      if (response.status === 401) {
        showToast("Please log in to save listings.", "error");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1200);
        return;
      }

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "Could not update wishlist.", "error");
        return;
      }

      // Update Navbar count badge
      const badge = document.getElementById("wishlist-count-badge");
      if (badge) {
        if (data.count > 0) {
          badge.textContent = data.count;
          badge.classList.remove("d-none");
        } else {
          badge.classList.add("d-none");
          badge.textContent = "0";
        }
      }

      // Update Button visual state (Card heart icon or Detail save button)
      if (btnElem) {
        const heartIcon = btnElem.querySelector("i");
        if (data.added) {
          btnElem.classList.add("active");
          btnElem.setAttribute("title", "Remove from wishlist");
          if (heartIcon) heartIcon.className = "fa-solid fa-heart text-danger";
          
          // Handle detail page button text if present
          if (btnElem.id === "save-wishlist-btn") {
            btnElem.innerHTML = '<i class="fa-solid fa-heart me-1 text-danger"></i> Saved';
            btnElem.classList.add("text-danger");
          }
        } else {
          btnElem.classList.remove("active");
          btnElem.setAttribute("title", "Save to wishlist");
          if (heartIcon) heartIcon.className = "fa-regular fa-heart";
          
          // Handle detail page button text if present
          if (btnElem.id === "save-wishlist-btn") {
            btnElem.innerHTML = '<i class="fa-regular fa-heart me-1"></i> Save';
            btnElem.classList.remove("text-danger");
          }
        }
      }

      // Dynamic Card Removal on /wishlist Page
      if (window.location.pathname === "/wishlist" && !data.added && btnElem) {
        const card = btnElem.closest(".listing-card");
        if (card) {
          card.style.transition = "all 0.3s ease";
          card.style.opacity = "0";
          card.style.transform = "scale(0.9)";
          setTimeout(() => {
            card.remove();
            const remainingCards = document.querySelectorAll(".listing-grid .listing-card");
            if (!remainingCards || remainingCards.length === 0) {
              window.location.reload();
            }
          }, 300);
        }
      }

      showToast(data.message, data.added ? "success" : "info");

    } catch (err) {
      console.error("Wishlist toggle error:", err);
      showToast("Unable to update wishlist. Please try again.", "error");
    }
  };

  // 4. Custom Toast Notification System
  window.showToast = (message, type = "info") => {
    let container = document.querySelector(".toast-container-custom");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container-custom";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    const bgClass = type === "success" ? "bg-dark" : type === "error" ? "bg-danger" : "bg-dark";
    const iconClass = type === "success" ? "fa-circle-check text-success" : type === "error" ? "fa-circle-exclamation text-warning" : "fa-heart text-danger";

    toast.className = `toast show align-items-center text-white ${bgClass} border-0 shadow-lg rounded-3 mb-2`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.setAttribute("aria-atomic", "true");

    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2 py-3 px-3">
          <i class="fa-solid ${iconClass} fs-5"></i>
          <span class="fw-semibold">${message}</span>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  // Auto-dismiss initial flash toasts after 4 seconds
  document.addEventListener("DOMContentLoaded", () => {
    // Clear legacy localStorage wishlist if present to prevent client-side count pollution
    try {
      localStorage.removeItem("wanderlust_wishlist");
    } catch (e) {}

    const existingToasts = document.querySelectorAll(".toast.show");
    existingToasts.forEach(toast => {
      setTimeout(() => {
        toast.classList.remove("show");
      }, 4000);
    });
  });

})();