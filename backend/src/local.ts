import app from './handlers/api';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Advitiyans API local server running on http://localhost:${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}/health`);
});
