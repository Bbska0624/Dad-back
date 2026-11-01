// Эх JS: dialog-ийн гадна (::backdrop) дарвал хаана.
export default function closeOnBackdrop(e) {
  const dialog = e.currentTarget;
  if (e.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
}
