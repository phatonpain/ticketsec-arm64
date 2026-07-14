#!/usr/bin/env python3
"""
train.py
Train a security ticket classifier using synthetic data.
Generates: models/baseline_model.pkl, models/vectorizer.pkl, data/tickets.csv
"""

import os
import pickle
import random
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

# Ensure dirs
os.makedirs("models", exist_ok=True)
os.makedirs("data", exist_ok=True)

# Synthetic security ticket dataset
CATEGORIES = ["Phishing", "Malware", "Unauthorized_Access", "Data_Breach", "DDoS", "False_Positive"]

TEMPLATES = {
    "Phishing": [
        "user reported suspicious email claiming to be from bank asking for credentials",
        "received email with fake login page link requesting password reset",
        "phishing campaign detected targeting employees with fake microsoft login",
        "user clicked on suspicious link in email and entered corporate credentials",
        "spear phishing attempt from compromised vendor account",
        "email impersonating CEO requesting urgent wire transfer",
        "fake invoice attachment with macro-enabled malware link",
        "credential harvesting page detected in email body",
    ],
    "Malware": [
        "endpoint detected trojan horse in downloaded executable",
        "antivirus flagged ransomware behavior on workstation",
        "suspicious powershell script execution blocked by EDR",
        "user machine infected with keylogger sending data externally",
        "malicious python script found in temp directory",
        "browser extension hijacking search results detected",
        "cryptominer using 90% CPU on server detected",
        "rootkit found during scheduled system scan",
    ],
    "Unauthorized_Access": [
        "failed login attempts from unknown IP address exceeding threshold",
        "admin account accessed from unusual geographic location",
        "privilege escalation attempt detected on database server",
        "after hours access to sensitive file share by contractor account",
        "brute force attack against VPN portal detected",
        "shared service account used from personal device",
        "terminated employee account still active in Active Directory",
        "lateral movement detected between DMZ and internal network",
    ],
    "Data_Breach": [
        "sensitive customer database found on public pastebin",
        "unauthorized S3 bucket exposing PII data discovered",
        "employee emailed confidential files to personal gmail account",
        "database dump containing credit card numbers leaked",
        "source code repository accidentally set to public",
        "third party vendor reported data exposure affecting our customers",
        "internal document with passwords found on public forum",
        "backup tape containing patient records lost in transit",
    ],
    "DDoS": [
        "network monitoring detected volumetric UDP flood attack",
        "web application firewall blocking layer 7 HTTP flood",
        "DNS amplification attack saturating upstream bandwidth",
        "slowloris attack exhausting web server connection pool",
        "CDN origin server overwhelmed by coordinated request spike",
        "API gateway rate limit exceeded by distributed botnet",
        "syn flood causing service degradation on public portal",
        "application layer attack targeting login endpoint",
    ],
    "False_Positive": [
        "legitimate marketing email incorrectly flagged as phishing",
        "internal automation script blocked by behavioral heuristic",
        "software update signed by vendor flagged as trojan",
        "penetration test activity triggered incident alert",
        "authorized batch job mistaken for cryptominer",
        "legitimate remote support tool flagged as RAT",
        "internal vulnerability scan blocked by IPS",
        "approved cloud sync service flagged as data exfiltration",
    ],
}

def generate_dataset(n_per_class=1000, seed=42):
    random.seed(seed)
    np.random.seed(seed)
    data = []
    for cat, templates in TEMPLATES.items():
        for _ in range(n_per_class):
            base = random.choice(templates)
            # Add slight noise/variation
            noise = " ".join([random.choice(["urgent", "high", "medium", "low", "critical"]),
                              random.choice(["ticket", "alert", "incident", "case"]),
                              str(random.randint(1000, 9999))])
            text = f"{noise} {base}"
            data.append({"text": text, "category": cat})
    df = pd.DataFrame(data)
    df = df.sample(frac=1, random_state=seed).reset_index(drop=True)
    return df


def main():
    print("[train] Generating synthetic security ticket dataset...")
    df = generate_dataset(n_per_class=1000)
    df.to_csv("data/tickets.csv", index=False)
    print(f"[train] Dataset: {len(df)} samples, {len(CATEGORIES)} categories")

    X = df["text"].values
    y = df["category"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("[train] Vectorizing with TF-IDF...")
    vectorizer = TfidfVectorizer(max_features=15000, ngram_range=(1, 2), stop_words="english")
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    print("[train] Training Random Forest classifier...")
    clf = RandomForestClassifier(
        n_estimators=800,
        max_depth=50,
        max_features='sqrt',
        min_samples_split=5,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced",
    )
    clf.fit(X_train_vec, y_train)

    y_pred = clf.predict(X_test_vec)
    acc = accuracy_score(y_test, y_pred)
    print(f"[train] Test accuracy: {acc:.4f}")
    print("[train] Classification report:")
    print(classification_report(y_test, y_pred, target_names=CATEGORIES))

    # Save
    with open("models/baseline_model.pkl", "wb") as f:
        pickle.dump(clf, f)
    with open("models/vectorizer.pkl", "wb") as f:
        pickle.dump(vectorizer, f)

    print("[train] Saved: models/baseline_model.pkl, models/vectorizer.pkl")
    print("[train] Done.")


if __name__ == "__main__":
    main()
