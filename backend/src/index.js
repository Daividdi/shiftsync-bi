const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// As respostas da API não devem ser guardadas em cache pelo navegador — os
// dados mudam a cada feed/upload e as telas fazem polling periódico; sem
// isso o navegador pode continuar servindo uma resposta antiga (só o ETag
// não é suficiente) mesmo depois de uma correção no backend.
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});

app.use("/api/upload", require("./routes/upload"));
app.use("/api/metrics", require("./routes/metrics"));
app.use("/api/quality", require("./routes/quality"));
app.use("/api/admin", require("./routes/admin").router);
app.use("/api/live", require("./routes/live"));
app.use("/api/exec", require("./routes/exec"));

app.get("/api/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`BI API running on :${PORT}`));
