const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/upload", require("./routes/upload"));
app.use("/api/metrics", require("./routes/metrics"));
app.use("/api/quality", require("./routes/quality"));
app.use("/api/admin", require("./routes/admin").router);
app.use("/api/live", require("./routes/live"));
app.use("/api/exec", require("./routes/exec"));

app.get("/api/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`BI API running on :${PORT}`));
