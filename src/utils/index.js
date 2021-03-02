// Manejo de fechas
const moment = require('moment');
// Librería llamadas http
const axios = require('axios');
// Generación uuid
const { v4: uuidv4 } = require('uuid');
// Para leer variables de entorno
require('dotenv').config();
const delay = require('delay');
// modelo de datos
const modeloTest = require('../models/test-model');

const generarEsqueletos = () => {
  // array con los esqueletos generados
  const esqueletos = [];
  const bloques = JSON.parse(process.env.BLOQUES);

  // Por cada bloque generamos un esqueleto
  for (let i = 0; i < bloques.length; i++) {
    const orderJSON = {};
    // Obtenemos fechas
    const segundoServicio = moment()
      .hour(8)
      .minute(0)
      .second(0)
      .add(2, 'days')
      .format('YYYY-MM-DDTHH:mm:ss[Z]');

    orderJSON.storeCode = process.env.TIENDA;

    orderJSON.proposalDateTime = moment()
      .hour(8)
      .minute(0)
      .second(0)
      .format('YYYY-MM-DDTHH:mm:ss[Z]');
    orderJSON.proposalDeadlineDateTime = moment()
      .hour(20)
      .minute(30)
      .second(0)
      .format('YYYY-MM-DDTHH:mm:ss[Z]');

    orderJSON.firstServiceDateTime = moment()
      .hour(8)
      .minute(0)
      .second(0)
      .add(1, 'days')
      .format('YYYY-MM-DDTHH:mm:ss[Z]');
    orderJSON.orderType = 'RELEX';
    const orderItemTypeInfoArray = [];
    const orderItemTypeInfo = {};
    orderItemTypeInfo.orderItemType = 'Y';
    orderItemTypeInfo.secondServiceDateTime = segundoServicio;
    orderItemTypeInfo.provisioningBulks = 100;
    orderItemTypeInfo.truckingBulks = 100;
    orderJSON.isEditable = true;
    orderItemTypeInfoArray.push(orderItemTypeInfo);
    orderJSON.orderItemTypeInfo = orderItemTypeInfoArray;
    const orderLines = [];
    for (let j = 1; j <= bloques[i]; j++) {
      const orderLine = {};
      orderLine.itemCode = j;
      orderLine.quantityFormat = 'UNIT';
      orderLine.proposalQuantity = 10;
      orderLine.undeliveredOrderQuantity = 0;
      orderLine.currentStock = 0;
      orderLine.itemCapacity = 1;
      orderLine.isInPromotion = false;
      orderLine.salesForecast = [];
      orderLines.push(orderLine);
    }
    orderJSON.orderLines = orderLines;
    esqueletos.push(orderJSON);
  }
  return esqueletos;
};

const performanceTestPost = async (esqueletos, id) => {
  const bloques = JSON.parse(process.env.BLOQUES);
  const resultados = [];
  const totalMensajes = esqueletos.length * process.env.ITERACIONES;
  let numMensaje = 0;
  // Iteramos por cada esqueleto
  for (let i = 0; i < esqueletos.length; i++) {
    const datos = esqueletos[i];
    const bytes = new Intl.NumberFormat('es-ES').format(
      (JSON.stringify(esqueletos[i], null, 2).length / 1024).toFixed(0)
    );
    if (process.env.LOGS == 1) {
      console.log(
        'BLOQUE ' +
          (i + 1) +
          ': Número artículos ' +
          bloques[i] +
          ' - Tamaño aprox ' +
          bytes +
          ' KB'
      );
      console.log('---------------------------------------------------------');
    }
    let max = 0;
    let min = 999999999;
    let tiempoTotal = 0;
    let id = '';
    // Por cada esqueleto se itera N veces
    for (let j = 0; j < process.env.ITERACIONES; j++) {
      numMensaje++;
      const resultado = {};
      resultado.tipo = 0;
      resultado.bytes = bytes;
      resultado.elementos = bloques[i];

      datos.orderProposalCode = uuidv4();
      resultado.orderProposalCode = datos.orderProposalCode;
      id = datos.orderProposalCode;
      const data = JSON.stringify(datos);
      const total = await enviarDatosPost(data, i, j, id, resultado);
      resultado.total = total;
      tiempoTotal += total;
      if (total > max) {
        max = total;
      }
      if (total < min) {
        min = total;
      }
      resultados.push(resultado);
      if (process.env.LOGS == 0) {
        console.clear();
        console.log(
          'FASE POST: Enviando mensaje ' +
            numMensaje +
            ' de ' +
            totalMensajes +
            ' => ' +
            (numMensaje * 100) / totalMensajes +
            '%'
        );
      }
    }
    if (process.env.LOGS == 1) {
      console.log(
        'Tiempo Máximo = ' +
          max +
          ' -- Tiempo mínimo = ' +
          min +
          '  -- Media = ' +
          (tiempoTotal / process.env.ITERACIONES).toFixed(0) +
          ' -- Media por artículo = ' +
          (tiempoTotal / process.env.ITERACIONES / bloques[i]).toFixed(2)
      );
      console.log('\n');
    }
  }
  return resultados;
};

const enviarDatosPost = async (data, i, j, id, resultado) => {
  const start = new Date().getTime();
  let total = 0;
  await axios
    .post(process.env.URL_POST, data, {
      headers: {
        'Content-Type': 'application/json',
        'ce-event-method': 'add',
        'ce-id': 'performance-test',
        'ce-source': '/performance',
        'ce-type': 'com.dia.store.supply.order.proposal',
      },
      timeout: 50000,
    })
    .then((res) => {
      const end = new Date().getTime();
      const totalServicio = new Date(end - start).getTime();
      resultado.inicio = start;
      resultado.fin = end;
      resultado.respuesta = res.status;
      const mensaje =
        'Mensaje ' +
        (j + 1) +
        ' de ' +
        process.env.ITERACIONES +
        ' - statusCode: ' +
        res.status +
        ' - ' +
        id +
        ' - Tiempo: ' +
        totalServicio +
        ' ms';
      if (process.env.LOGS == 1) {
        console.log(mensaje);
      }
      total = totalServicio;
    })
    .catch((error) => {
      console.log(error);
    });
  return total;
};

const performanceTestGet = async (resultadosPost) => {
  const resultados = [];
  // Por cada pedido enviado
  for (let i = 0; i < resultadosPost.length; i++) {
    const totalMensajes = resultadosPost.length;
    let url = process.env.URL_GET;
    url = url
      .replace('{t}', process.env.TIENDA)
      .replace('{p}', resultadosPost[i].orderProposalCode);
    // Vamos a hacer 2 llamadas iguales, ya que la primera no está cacheada
    for (let j = 0; j < 2; j++) {
      const resultado = {};
      resultado.orderProposalCode = resultadosPost[i].orderProposalCode;
      resultado.tipo = 1;
      const start = new Date().getTime();
      axios
        .get(url, {
          headers: { accept: 'application/json' },
          timeout: 20000,
        })
        .then((res) => {
          const end = new Date().getTime();
          const totalServicio = new Date(end - start).getTime();
          if (process.env.LOGS == 0) {
            console.clear();
            let mensaje =
              'FASE POST: Enviando mensaje ' +
              totalMensajes +
              ' de ' +
              totalMensajes +
              ' => 100 %\n';
            mensaje +=
              'FASE GET: Recuperando propuesta ' +
              (i + 1) +
              ' de ' +
              totalMensajes +
              ' => ' +
              ((i + 1) * 100) / totalMensajes +
              '%';
            console.log(mensaje);
          } else {
            console.log(
              'GET proposal ' +
                resultado.orderProposalCode +
                ' - ' +
                res.status +
                ' - ' +
                totalServicio
            );
          }
          resultado.inicio = start;
          resultado.fin = end;
          resultado.respuesta = res.status;
          resultado.total = totalServicio;
          resultados.push(resultado);
        })
        .catch((e) => {
          const end = new Date().getTime();
          const totalServicio = new Date(end - start).getTime();
          resultado.inicio = start;
          resultado.fin = end;
          resultado.respuesta = e.response.status;
          resultado.total = totalServicio;
          resultados.push(resultado);
        });
      await delay(process.env.ESPERA);
    }
  }
  return resultados;
};

const guardarInformeTest = async (resultadosPost, resultadosGet) => {
  // Creo el identificador único de la prueba
  const uuid = uuidv4();
  const datos = resultadosPost.concat(resultadosGet);
  for (let i = 0; i < datos.length; i++) {
    try {
      const modelo = new modeloTest({
        uuid: uuid,
        fecha: new Date(),
        tipo: datos[i].tipo,
        byes: datos[i].bytes,
        iteraciones: datos[i].iteraciones,
        elementos: datos[i].elementos,
        orderProposalCode: datos[i].orderProposalCode,
        inicio: datos[i].inicio,
        fin: datos[i].fin,
        respuesta: datos[i].respuesta,
        total: datos[i].total,
      });
      await modelo.save();
    } catch (e) {
      console.log(e);
    }
  }
  return uuid;
};

const generarInformeTest = async (uuid) => {
  // primero recupero los datos de la prueba, con tipo 0 (POST)
  const datos = await modeloTest
    .find({ uuid: uuid, tipo: 0 })
    .sort({ tipo: 1, elementos: 1 });

  for (let i = 0; i < datos.length; i++) {
    // recupero los registros de los gets
    const datosGet = await modeloTest.find({
      uuid: datos[i].uuid,
      tipo: 1,
      orderProposalCode: datos[i].orderProposalCode,
    });
    for (let j = 0; j < datosGet.length; j++) {
      console.log(
        'POST: Propuesta ' +
          datos[i].orderProposalCode +
          ' - ' +
          datos[i].elementos +
          ' artículos - ' +
          datos[i].respuesta +
          ' - ' +
          datos[i].total +
          ' ms ** GET: ' +
          datosGet[j].respuesta +
          ' - ' +
          datosGet[j].total +
          ' ms'
      );
    }
  }
};

module.exports = {
  generarEsqueletos,
  performanceTestPost,
  performanceTestGet,
  guardarInformeTest,
  generarInformeTest,
};
