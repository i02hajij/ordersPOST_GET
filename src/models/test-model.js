const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const esquemaTest = new Schema({
  uuid: {type: String, required: true},
  fecha: {type: Date, required: true},
  tipo: { type: Number, required: true },
  bytes: { type: Number },
  iteraciones: { type: Number },
  elementos: { type: Number },
  orderProposalCode: { type: String, required: true },
  inicio: { type: Date, required: true },
  fin: { type: Date, required: true },
  respuesta: { type: Number, required: true },
  total: { type: Number, required: true },
});

const modeloTest = mongoose.model('tests', esquemaTest);

module.exports = modeloTest;
