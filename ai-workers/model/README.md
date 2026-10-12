# Disaster Image Classifier (Prediction Module)

Part of the **Disaster Management Hub** project. This module classifies disaster images
from social media into a disaster type, and exposes the model through a REST API so the
frontend and other teams can use it.

> Status: **prototype**. Social-media images only. Drone imagery is planned (see Roadmap).

## What it does

Given an image, the API returns:

- the predicted class: `earthquake`, `fire`, `flood`, `hurricane`, `landslide`, `other_disaster`, or `not_disaster`
- a confidence score and the top-3 predictions
- a `needs_review` flag when confidence is low, so a human can check the result

## Project structure

```
.
├── app.py                        # FastAPI service (POST /predict, GET /health)
├── train_disaster_types.py       # Training script (PyTorch + timm)
├── train_disaster_types.ipynb    # Same training code as a notebook (Colab friendly)
├── check_model.ipynb             # Evaluation: metrics, confusion matrix, Grad-CAM, thresholds
├── requirements.txt
├── best_model.pt
├── classes.json
└── README.md
```

## Dataset

[CrisisNLP / MEDIC "Disaster types" task set](https://crisisnlp.qcri.org/crisis-image-datasets-asonam20)
(about 3.2 GB). It is **not included in this repository**. Download it yourself and
extract it. The dataset is released for research use, so read its terms before any
public or commercial use, and cite the original paper (Alam et al., ASONAM 2020,
arXiv:2011.08916).

Note: the paths in the TSV files contain an extra `aidr_disaster_types/` folder that
does not exist after extraction. The loader in `train_disaster_types.py` handles this.
At training start, check the printed image counts: if many rows are reported as
missing, the paths do not match your folder layout.

## Setup

```bash
git clone https://github.com/Dhruvil-14/IT314_Software_Project
cd IT314_Software_Project

python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

## Train

Training on CPU is slow. A free GPU on Google Colab or Kaggle is recommended.

1. Extract the dataset and set `ROOT` in the config section of `train_disaster_types.py`
   (or the config cell of the notebook).
2. Run `python train_disaster_types.py`, or run `train_disaster_types.ipynb` top to bottom.
3. Outputs are saved to `outputs/`: `best_model.pt`, `classes.json`, `confusion_matrix.png`.

Suggested settings:

| Hardware | Model | Image size | Epochs | `UNFREEZE_LAST_FRACTION` |
|---|---|---|---|---|
| GPU (Colab/Kaggle) | `convnext_tiny` | 224 | 12 | 1 |
| CPU only | `mobilenetv3_large_100` | 192 | 6 | 0.3 |

## Evaluate

Open `check_model.ipynb` after training. It shows per-class metrics, the confusion
matrix, confidence/"needs review" trade-offs, the most confident mistakes, and Grad-CAM
heatmaps. Judge the model with **per-class F1 and recall**, not accuracy alone.

## Run the API

Place `best_model.pt`  next to `app.py`, then:

```bash
uvicorn app:app --reload
```

Open http://127.0.0.1:8000/docs, choose **POST /predict**, click **Try it out**, upload
an image, and press **Execute**.

Example response:

```json
{
  "prediction": "flood",
  "confidence": 0.91,
  "top3": [{"label": "flood", "confidence": 0.91}, "..."],
  "needs_review": false
}
```

Calling it from a frontend:

```javascript
const form = new FormData();
form.append("file", imageFile);   // field name must be "file"
const res = await fetch("http://127.0.0.1:8000/predict", { method: "POST", body: form });
const result = await res.json();
```

## Model file

`best_model.pt` is not stored in git

`Model download: https://drive.google.com/file/d/1h8_TlYqEoUh_M_RfgIbnNGz2qmAOqk9a/view?usp=sharing`

## Results

Add the final test accuracy, macro-F1 and the per-class table here after the full
training run on the complete dataset.

## Known limitations

- Trained on social media images only; performance on drone imagery is unknown.
- Labels come from crowd workers and contain noise.
- Rare classes (landslide, earthquake) and confusion with `other_disaster` need
  attention. Low-confidence predictions are flagged for human review.

## Roadmap

- [ ] Retrain on the complete dataset and record final metrics
- [ ] Add drone data (e.g. AIDER) with a shared backbone and a second classification head
- [ ] Batch prediction endpoint
- [ ] Docker image and deployment

## Team

Prediction team, Disaster Management Hub.
