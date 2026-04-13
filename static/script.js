const form = document.getElementById("detectForm");
const endpointInput = document.getElementById("endpoint");
const apiKeyInput = document.getElementById("api_key");
const imageInput = document.getElementById("image");
const saveLocalCheckbox = document.getElementById("saveLocal");
const statusBox = document.getElementById("statusBox");
const btnText = document.getElementById("btnText");
const faceCount = document.getElementById("faceCount");
const canvas = document.getElementById("resultCanvas");
const ctx = canvas.getContext("2d");
const emptyState = document.getElementById("emptyState");

// Load saved values from localStorage
window.addEventListener("DOMContentLoaded", () => {
  const savedEndpoint = localStorage.getItem("azure_endpoint");
  const savedApiKey = localStorage.getItem("azure_api_key");

  if (savedEndpoint) endpointInput.value = savedEndpoint;
  if (savedApiKey) apiKeyInput.value = savedApiKey;
});

function showStatus(message, type = "success") {
  statusBox.classList.remove("hidden", "success", "error");
  statusBox.classList.add(type);
  statusBox.innerHTML = message;
}

function resetCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  faceCount.textContent = "0";
}

async function drawImageWithBoxes(imageDataUrl, faces) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      ctx.lineWidth = Math.max(2, img.width / 250);
      ctx.font = `${Math.max(16, img.width / 45)}px Arial`;

      faces.forEach((face, index) => {
        ctx.strokeStyle = "#00ff99";
        ctx.fillStyle = "rgba(0, 255, 153, 0.15)";
        ctx.strokeRect(face.left, face.top, face.width, face.height);
        ctx.fillRect(face.left, face.top, face.width, face.height);

        const label = `Face ${index + 1}`;
        const textX = face.left;
        const textY = Math.max(24, face.top - 8);

        ctx.fillStyle = "#00ff99";
        ctx.fillText(label, textX, textY);
      });

      emptyState.style.display = "none";
      resolve();
    };

    img.onerror = reject;
    img.src = imageDataUrl;
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  resetCanvas();
  showStatus("Processing image and calling Azure Face API...", "success");
  btnText.textContent = "Detecting...";
  form.querySelector("button").disabled = true;

  try {
    const endpoint = endpointInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const imageFile = imageInput.files[0];

    if (!endpoint || !apiKey || !imageFile) {
      showStatus("Please fill endpoint, key, and choose an image.", "error");
      return;
    }

    if (saveLocalCheckbox.checked) {
      localStorage.setItem("azure_endpoint", endpoint);
      localStorage.setItem("azure_api_key", apiKey);
    } else {
      localStorage.removeItem("azure_endpoint");
      localStorage.removeItem("azure_api_key");
    }

    const formData = new FormData();
    formData.append("endpoint", endpoint);
    formData.append("api_key", apiKey);
    formData.append("image", imageFile);

    const response = await fetch("/detect-faces", {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const details = data.details ? `<br><small>${JSON.stringify(data.details)}</small>` : "";
      showStatus(`${data.message || "Something went wrong."}${details}`, "error");
      return;
    }

    faceCount.textContent = data.faceCount;
    await drawImageWithBoxes(data.imageDataUrl, data.faces);

    showStatus(`Success! ${data.faceCount} face(s) detected.`, "success");
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
  } finally {
    btnText.textContent = "Detect Faces";
    form.querySelector("button").disabled = false;
  }
});