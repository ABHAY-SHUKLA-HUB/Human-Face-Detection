from flask import Flask, render_template, request, jsonify
import requests
import base64

app = Flask(__name__)

MAX_IMAGE_SIZE = 4 * 1024 * 1024  # 4 MB for Vision 3.2


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/detect-faces", methods=["POST"])
def detect_faces():
    try:
        endpoint = request.form.get("endpoint", "").strip()
        api_key = request.form.get("api_key", "").strip()
        image = request.files.get("image")

        if not endpoint:
            return jsonify({"success": False, "message": "Endpoint is required."}), 400

        if not api_key:
            return jsonify({"success": False, "message": "API key is required."}), 400

        if not image:
            return jsonify({"success": False, "message": "Please upload an image."}), 400

        if image.filename == "":
            return jsonify({"success": False, "message": "No file selected."}), 400

        # Check MIME type from browser upload
        if not image.mimetype or not image.mimetype.startswith("image/"):
            return jsonify({
                "success": False,
                "message": f"Invalid file type: {image.mimetype}. Please upload a real image."
            }), 400

        image_bytes = image.read()

        if not image_bytes:
            return jsonify({
                "success": False,
                "message": "Uploaded image is empty."
            }), 400

        if len(image_bytes) > MAX_IMAGE_SIZE:
            return jsonify({
                "success": False,
                "message": "Image is too large. Please upload an image under 4 MB."
            }), 400

        endpoint = endpoint.rstrip("/")
        analyze_url = f"{endpoint}/vision/v3.2/analyze?visualFeatures=Faces"

        headers = {
            "Ocp-Apim-Subscription-Key": api_key,
            "Content-Type": "application/octet-stream"
        }

        azure_response = requests.post(
            analyze_url,
            headers=headers,
            data=image_bytes,
            timeout=30
        )

        if azure_response.status_code != 200:
            try:
                error_json = azure_response.json()
            except Exception:
                error_json = {"error": {"message": azure_response.text}}

            return jsonify({
                "success": False,
                "message": "Azure API request failed.",
                "details": error_json
            }), azure_response.status_code

        result = azure_response.json()
        faces = result.get("faces", [])

        encoded_image = base64.b64encode(image_bytes).decode("utf-8")
        mime_type = image.mimetype or "image/jpeg"
        image_data_url = f"data:{mime_type};base64,{encoded_image}"

        face_boxes = []
        for face in faces:
            rect = face.get("faceRectangle", {})
            face_boxes.append({
                "left": rect.get("left", 0),
                "top": rect.get("top", 0),
                "width": rect.get("width", 0),
                "height": rect.get("height", 0),
                "age": face.get("age"),
                "gender": face.get("gender")
            })

        return jsonify({
            "success": True,
            "message": f"{len(face_boxes)} face(s) detected successfully.",
            "faceCount": len(face_boxes),
            "faces": face_boxes,
            "imageDataUrl": image_data_url
        })

    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False,
            "message": "Network error while calling Azure API.",
            "details": str(e)
        }), 500

    except Exception as e:
        return jsonify({
            "success": False,
            "message": "Internal server error.",
            "details": str(e)
        }), 500


if __name__ == "__main__":
    app.run(debug=True)