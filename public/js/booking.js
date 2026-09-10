(() => {
  const form = document.getElementById("booking-form");
  if (!form) return;

  const checkIn = document.getElementById("booking-check-in");
  const checkOut = document.getElementById("booking-check-out");
  const guests = document.getElementById("booking-guests");
  const nightsOutput = document.getElementById("booking-nights");
  const subtotalOutput = document.getElementById("booking-subtotal");
  const totalOutput = document.getElementById("booking-total");
  const errorOutput = document.getElementById("booking-error");
  const button = document.getElementById("book-now-button");
  const price = Number(form.dataset.price);
  const listingId = form.dataset.listingId;
  const today = new Date();
  const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  checkIn.min = todayText;
  checkOut.min = todayText;

  const displayTotal = () => {
    if (checkIn.value) checkOut.min = checkIn.value;
    const start = new Date(`${checkIn.value}T00:00:00`);
    const end = new Date(`${checkOut.value}T00:00:00`);
    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (Number.isFinite(nights) && nights > 0) {
      const subtotal = nights * price;
      if (nightsOutput) nightsOutput.textContent = String(nights);
      if (subtotalOutput) subtotalOutput.textContent = subtotal.toLocaleString("en-IN");
      if (totalOutput) totalOutput.textContent = subtotal.toLocaleString("en-IN");
    } else {
      if (nightsOutput) nightsOutput.textContent = "0";
      if (subtotalOutput) subtotalOutput.textContent = "0";
      if (totalOutput) totalOutput.textContent = "0";
    }
  };
  checkIn.addEventListener("change", displayTotal);
  checkOut.addEventListener("change", displayTotal);

  const setLoading = (loading) => {
    button.disabled = loading;
    button.textContent = loading ? "Processing..." : "Reserve Stay";
  };
  const showError = (message) => {
    errorOutput.textContent = message;
    errorOutput.classList.remove("d-none");
  };
  const postJson = async (url, body) => {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({ message: "Unexpected server response." }));
    if (!response.ok) throw new Error(data.message || "Request failed.");
    return data;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorOutput.classList.add("d-none");
    if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
    setLoading(true);
    const details = { checkIn: checkIn.value, checkOut: checkOut.value, guests: Number(guests.value) };
    try {
      const order = await postJson(`/listings/${listingId}/bookings/create-order`, details);
      const checkout = new Razorpay({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: "Wanderlust",
        description: `Booking for ${order.listingTitle}`,
        order_id: order.orderId,
        prefill: order.user,
        theme: { color: "#FF385C" },
        handler: async (payment) => {
          try {
            const verified = await postJson("/bookings/verify-payment", { ...payment, listingId, ...details });
            window.location.assign(verified.redirectUrl);
          } catch (error) {
            showError(error.message + " If payment was deducted, please keep your payment ID and contact support.");
            setLoading(false);
          }
        },
        modal: { ondismiss: () => { showError("Payment was not completed."); setLoading(false); } },
      });
      checkout.on("payment.failed", (response) => { showError(response.error.description || "Payment failed. Please try again."); setLoading(false); });
      checkout.open();
    } catch (error) {
      if (error.message.toLowerCase().includes("logged in")) window.location.assign(`/login`);
      else { showError(error.message); setLoading(false); }
    }
  });
})();
