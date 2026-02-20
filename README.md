PROBLEM STATEMENT:-
Money Muling Detection Engine
Graph-Based Financial Crime Detection System
RIFT 2026 – Graph Theory / Financial Crime Detection Track

🔗 Live Application
🌐 Deployed URL:
https://mulermoney.lovable.app/

Publicly accessible

No authentication required

CSV upload available on homepage

JSON output downloadable

📌 Problem Overview
Money muling is a financial crime in which illicit funds are transferred through networks of accounts to obscure their origin. These laundering networks typically exhibit:

Circular fund routing (cycles)

Smurfing (fan-in / fan-out aggregation within short windows)

Layered shell account chains

Traditional relational queries fail to detect these multi-hop structures.

This project implements a graph-based financial forensics engine that detects and visualizes money muling networks using deterministic graph algorithms and temporal analysis.

🏗 System Architecture
CSV Upload
   ↓
Transaction Parser
   ↓
Directed Graph Construction (Adjacency List)
   ↓
Fraud Pattern Detection Engine
   ├─ Cycle Detection (DFS, depth ≤ 5)
   ├─ Smurfing Detection (72-hour sliding window)
   ├─ Shell Network Detection (multi-hop chains)
   ├─ Ring Canonicalization & Deduplication
   ├─ Ring Merging (≥ 70% overlap)
   ↓
Suspicion Scoring Engine
   ↓
JSON Output + Interactive Graph Visualization
🛠 Technology Stack
Frontend
React (Vite)

TypeScript

Tailwind CSS

shadcn-ui

Core Logic
Graph-based detection engine

DFS-based cycle detection

Sliding window temporal clustering

Canonical grouping logic

Deployment
Lovable hosted web application

Detection Algorithms :-
1. Graph Representation
Transactions are modeled as a directed graph:

graph: Map<AccountID, Set<ReceiverAccountID>>
Additionally maintained:

Incoming adjacency list

Transaction metadata (timestamp, amount)

Degree counts (in-degree, out-degree)

Time Complexity:

Graph construction → O(V + E)

Where:

V = number of accounts

E = number of transactions

2. Circular Fund Routing (Cycle Detection)
Detects cycles of length 3–5 using depth-limited DFS.

Approach
Iterative DFS (prevents stack overflow)

Path tracking with visited set

Depth limited to 5

Canonical member sorting

Subset elimination (keep maximal cycles only)

Canonicalization Logic
Sort member_accounts alphabetically

Convert to canonical string key

Use Set to eliminate permutations

If cycle A ⊂ cycle B → discard A

This prevents artificial ring inflation.

Time Complexity:

O(V + E) (bounded depth traversal)

3. Smurfing Detection (Fan-In / Fan-Out)
Fan-In Pattern
If ≥ 10 unique senders transfer funds to one receiver within 72 hours.

Fan-Out Pattern
If one sender transfers to ≥ 10 unique receivers within 72 hours.

Implementation
Transactions grouped by sender/receiver

Sliding 72-hour window

Distinct account counting

Single ring created per aggregator

Prevents long-term legitimate aggregation from being falsely flagged.

Time Complexity:

O(E log E) (time-window grouping)

4. Layered Shell Network Detection
Detects laundering chains where:

Path length ≥ 3

Intermediate nodes have total degree ≤ 3

Sequential transactions occur within 72-hour window

Overlap Handling
Overlapping shell chains grouped

Permutations eliminated

≥ 70% overlapping rings merged

This ensures distinct fraud groups only.

🎯 Suspicion Scoring Methodology
Weighted rule-based scoring model:

Pattern	Score Contribution
Base Score	20
cycle_length_3	+20
cycle_length_4	+30
cycle_length_5	+40
fan_in_72h	+35
fan_out_72h	+35
shell_network	+25
Appears in multiple rings	+10
Rules:

Capped at 100

Normalized between 0–100

Sorted descending in output

Fraud Ring Risk Score
risk_score = average(suspicion_score of member_accounts)
Longer and multi-pattern rings naturally yield higher risk.

🧠 False Positive Control
To minimize false positives:

High-volume accounts without circular flow are not flagged as cycles

Temporal clustering required for smurfing

One-directional high-volume accounts reduce suspicion

Accounts with long-distributed transactions lower risk weighting

Canonical deduplication prevents artificial ring inflation

This improves precision while maintaining recall.

📊 JSON Output Compliance
Output strictly matches required format:

{
  "suspicious_accounts": [
    {
      "account_id": "ACC_00123",
      "suspicion_score": 87.5,
      "detected_patterns": ["cycle_length_3"],
      "ring_id": "RING_001"
    }
  ],
  "fraud_rings": [
    {
      "ring_id": "RING_001",
      "member_accounts": ["ACC_00123"],
      "pattern_type": "cycle_length_3",
      "risk_score": 95.3
    }
  ],
  "summary": {
    "total_accounts_analyzed": 500,
    "suspicious_accounts_flagged": 15,
    "fraud_rings_detected": 4,
    "processing_time_seconds": 2.3
  }
}
✔ suspicion_score is float
✔ Sorted descending
✔ Exact field naming
✔ No extra keys
✔ fraud_rings_detected reflects canonical grouping

⚡ Performance
Tested on 500+ accounts in ~0.1 seconds

Designed for up to 10,000 transactions

Depth-limited traversal prevents exponential blow-up

Avoids nested O(N³) operations

Meets ≤ 30 second requirement

Overall Complexity:

Graph Construction → O(V + E)

Cycle Detection → O(V + E)

Smurfing Detection → O(E log E)

Shell Detection → O(V + E)

🖥 Key Features
Interactive directed graph visualization

Risk-based color gradient (low → high)

Fraud ring summary table

Suspicious account sidebar

Account drill-down analysis

“Why Flagged?” explainability panel

Downloadable JSON output

* Usage Instructions
Upload CSV file on homepage

System parses transactions

Graph auto-generates

Click suspicious accounts for details

Review fraud ring summary

Download JSON output

Required CSV Format:

transaction_id,sender_id,receiver_id,amount,timestamp
Timestamp format:
YYYY-MM-DD HH:MM:SS


