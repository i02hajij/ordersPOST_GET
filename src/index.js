// MongoDB
const mongo = require('mongoose');
// utilidades varias
const Utils = require('./utils');
// Para leer variables de entorno
require('dotenv').config();

const pruebaRendimiento = async () => {
  // Generar los esqueletos de la entidad seleccionada
  const esqueletos = Utils.generarEsqueletos();
  // enviamos los mensajes
  const resultadosPost = await Utils.performanceTestPost(esqueletos);
  if (process.env.LOGS == 1) {
    console.log('-----------------------');
    console.log('Inicio recuperación de mensajes');
  }
  const resultadosGet = await Utils.performanceTestGet(resultadosPost);
  console.log('GUARDANDO DATOS EN MONGO');
  const uuid = await Utils.guardarInformeTest(resultadosPost, resultadosGet);
  console.log('GENERANDO INFORME -- ' + uuid);
  await Utils.generarInformeTest(uuid);
  process.exit(1);
};

// primero conectamos con la BBDD
mongo
  .connect(process.env.MONGO, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    pruebaRendimiento();
  })
  .catch((error) => {
    console.log('Error en la conexión a la mongo');
  });
