// Reemplazos mínimos de librerías que la app descarga solo cuando las necesita.
// Los tests verifican la app (datos, pantallas, escrituras), no los gráficos ni el parser
// de Excel, así que alcanza con algo que responda la misma interfaz.

const STUB_CHART = `
window.Chart = class Chart {
  constructor(el, cfg){ this.canvas = el; this.config = cfg; this.data = cfg && cfg.data; }
  update(){} destroy(){} resize(){}
};`;

// xlsx: solo lo que usa leerFilasExtracto() (finanzas.js) con un CSV.
const STUB_XLSX = `
window.XLSX = {
  read(contenido, opts){
    const texto = typeof contenido === 'string' ? contenido : new TextDecoder('utf-8').decode(contenido);
    return { SheetNames: ['Hoja1'], Sheets: { Hoja1: { __csv: texto } } };
  },
  utils: {
    sheet_to_json(hoja){
      return hoja.__csv.split(/\\r?\\n/).filter(l => l.trim()).map(l => l.split(';').length > 1 ? l.split(';') : l.split(','));
    }
  }
};`;

module.exports = { STUB_CHART, STUB_XLSX };
