const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================================
// CONFIGURACIÓN
// =====================================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(helmet());

app.use(
  cors({
    origin: "*",
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// =====================================================
// MULTER
// =====================================================
// Solo una fotografía.
// Máximo 5 MB.
// Únicamente personas no localizadas.

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(
        new Error("Solo se permiten imágenes")
      );
    }

    cb(null, true);
  },
});

// =====================================================
// CONEXIÓN MONGODB
// =====================================================

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("=================================");
    console.log("✅ CONECTADO A MONGODB");
    console.log("=================================");
  })
  .catch((error) => {
    console.error("❌ ERROR MONGODB:", error);
  });

// =====================================================
// MUNICIPIOS HABILITADOS
// =====================================================

const MUNICIPIOS = [
  "Armenia",
  "Bagadó",
  "Bugalagrande",
  "Cali",
  "Cartago",
  "Certegui",
  "Condoto",
  "Dosquebradas",
  "El Cantón de San Pablo",
  "La Tebaida",
  "La Unión",
  "La Victoria",
  "Manizales",
  "Montenegro",
  "Novita",
  "Pereira",
  "Quibdó",
  "Roldanillo",
  "Salento",
  "San Francisco",
  "San José del Palmar",
  "Subachoque",
  "Tabio",
  "Tadó",
  "Toro",
  "Tuluá",
  "Viterbo",
  "Zarzal",
];

// =====================================================
// DEPARTAMENTO POR MUNICIPIO
// =====================================================

const DEPARTAMENTO_POR_MUNICIPIO = {
  Armenia: "Quindío",

  Bagadó: "Chocó",
  Certegui: "Chocó",
  Condoto: "Chocó",
  "El Cantón de San Pablo": "Chocó",
  Novita: "Chocó",
  Quibdó: "Chocó",
  "San José del Palmar": "Chocó",
  Tadó: "Chocó",

  Bugalagrande: "Valle del Cauca",
  Cali: "Valle del Cauca",
  Cartago: "Valle del Cauca",
  "La Unión": "Valle del Cauca",
  "La Victoria": "Valle del Cauca",
  Roldanillo: "Valle del Cauca",
  Toro: "Valle del Cauca",
  Tuluá: "Valle del Cauca",
  Zarzal: "Valle del Cauca",

  Dosquebradas: "Risaralda",
  Pereira: "Risaralda",

  Manizales: "Caldas",
  Viterbo: "Caldas",

  "San Francisco": "Cundinamarca",
  Subachoque: "Cundinamarca",
  Tabio: "Cundinamarca",

  "La Tebaida": "Quindío",
  Montenegro: "Quindío",
  Salento: "Quindío",
};

// =====================================================
// TIPOS DE REPORTE
// =====================================================

const TIPOS_REPORTE = [
  "Necesito ayuda",
  "Daños en mi vivienda",
  "Persona no localizada",
  "Estoy a salvo",
  "Quiero ofrecer ayuda",
  "Otro reporte",
];

// =====================================================
// SCHEMA REPORTE
// =====================================================

const emergenciaSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    ciudad: {
      type: String,
      required: true,
      trim: true,
      enum: MUNICIPIOS,
    },

    departamento: {
      type: String,
      default: "",
      trim: true,
    },

    direccion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },

    tipoReporte: {
      type: String,
      required: true,
      enum: TIPOS_REPORTE,
    },

    telefonoWhatsapp: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    estadoVivienda: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    personasAfectadas: {
      type: Number,
      default: 1,
      min: 1,
      max: 1000,
    },

    necesidades: {
      type: [String],
      default: [],
    },

    descripcion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // =================================================
    // FOTO
    // SOLO PARA PERSONA NO LOCALIZADA
    // =================================================

    foto: {
      url: {
        type: String,
        default: "",
      },

      public_id: {
        type: String,
        default: "",
      },
    },

    // =================================================
    // UBICACIÓN PARA MAPA
    // =================================================

    latitud: {
      type: Number,
      default: null,
    },

    longitud: {
      type: Number,
      default: null,
    },

    // =================================================
    // CONTROL
    // =================================================

    activa: {
      type: Boolean,
      default: true,
    },

    fechaCreacion: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// ÍNDICES
// =====================================================

emergenciaSchema.index({
  ciudad: 1,
  tipoReporte: 1,
});

emergenciaSchema.index({
  departamento: 1,
});

emergenciaSchema.index({
  fechaCreacion: -1,
});

emergenciaSchema.index({
  activa: 1,
});

emergenciaSchema.index({
  latitud: 1,
  longitud: 1,
});

const Emergencia = mongoose.model(
  "Emergencia",
  emergenciaSchema
);

// =====================================================
// CLOUDINARY
// =====================================================

const subirFotoEmergencia = async (
  buffer,
  reporteId
) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: `tiendasapp/emergencias/${reporteId}`,

          public_id: "persona",

          resource_type: "image",

          transformation: [
            {
              width: 1000,
              height: 1000,
              crop: "limit",
            },
            {
              quality: "auto",
            },
          ],
        },

        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      )
      .end(buffer);
  });
};

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    servicio: "Sistema de Ayuda Ciudadana",
    fecha: new Date().toISOString(),
  });
});

// =====================================================
// MUNICIPIOS
// =====================================================

app.get("/api/municipios", (req, res) => {
  res.json(MUNICIPIOS);
});

// =====================================================
// DEPARTAMENTOS
// =====================================================

app.get("/api/departamentos", (req, res) => {
  const departamentos = [
    ...new Set(
      Object.values(
        DEPARTAMENTO_POR_MUNICIPIO
      )
    ),
  ].sort();

  res.json(departamentos);
});

// =====================================================
// TIPOS DE REPORTE
// =====================================================

app.get("/api/tipos-reporte", (req, res) => {
  res.json(TIPOS_REPORTE);
});

// =====================================================
// CREAR REPORTE
// =====================================================

app.post(
  "/api/emergencias",
  upload.single("foto"),
  async (req, res) => {
    try {
      const {
        nombre,
        ciudad,
        direccion,
        tipoReporte,
        telefonoWhatsapp,
        estadoVivienda,
        personasAfectadas,
        necesidades,
        descripcion,
        latitud,
        longitud,
      } = req.body;

      // =================================================
      // VALIDACIONES
      // =================================================

      if (!nombre || !nombre.trim()) {
        return res.status(400).json({
          error: "El nombre es obligatorio",
        });
      }

      if (!ciudad) {
        return res.status(400).json({
          error: "La ciudad es obligatoria",
        });
      }

      if (!MUNICIPIOS.includes(ciudad)) {
        return res.status(400).json({
          error:
            "El municipio seleccionado no está habilitado",
        });
      }

      if (!direccion || !direccion.trim()) {
        return res.status(400).json({
          error: "La dirección es obligatoria",
        });
      }

      if (!tipoReporte) {
        return res.status(400).json({
          error:
            "El tipo de reporte es obligatorio",
        });
      }

      if (!TIPOS_REPORTE.includes(tipoReporte)) {
        return res.status(400).json({
          error: "Tipo de reporte inválido",
        });
      }

      if (
        !telefonoWhatsapp ||
        !telefonoWhatsapp.trim()
      ) {
        return res.status(400).json({
          error:
            "El teléfono es obligatorio",
        });
      }

      if (!descripcion || !descripcion.trim()) {
        return res.status(400).json({
          error:
            "La descripción es obligatoria",
        });
      }

      // =================================================
      // FOTO
      // =================================================

      if (
        tipoReporte ===
          "Persona no localizada" &&
        !req.file
      ) {
        return res.status(400).json({
          error:
            "Debes adjuntar una fotografía de la persona no localizada",
        });
      }

      if (
        tipoReporte !==
          "Persona no localizada" &&
        req.file
      ) {
        return res.status(400).json({
          error:
            "La fotografía solamente está permitida para personas no localizadas",
        });
      }

      // =================================================
      // NECESIDADES
      // =================================================

      let necesidadesArray = [];

      if (necesidades) {
        try {
          necesidadesArray =
            typeof necesidades === "string"
              ? JSON.parse(necesidades)
              : necesidades;

          if (
            !Array.isArray(
              necesidadesArray
            )
          ) {
            necesidadesArray = [];
          }
        } catch (error) {
          necesidadesArray = [];
        }
      }

      // =================================================
      // DEPARTAMENTO AUTOMÁTICO
      // =================================================

      const departamento =
        DEPARTAMENTO_POR_MUNICIPIO[
          ciudad
        ] || "";

      // =================================================
      // CREAR REPORTE
      // =================================================

      const nuevoReporte =
        new Emergencia({
          nombre: nombre.trim(),

          ciudad,

          departamento,

          direccion:
            direccion.trim(),

          tipoReporte,

          telefonoWhatsapp:
            telefonoWhatsapp.replace(
              /\D/g,
              ""
            ),

          estadoVivienda:
            estadoVivienda || "",

          personasAfectadas:
            Number(
              personasAfectadas
            ) || 1,

          necesidades:
            necesidadesArray,

          descripcion:
            descripcion.trim(),

          latitud:
            latitud
              ? Number(latitud)
              : null,

          longitud:
            longitud
              ? Number(longitud)
              : null,
        });

      const reporteGuardado =
        await nuevoReporte.save();

      // =================================================
      // SUBIR FOTO
      // =================================================

      if (
        tipoReporte ===
          "Persona no localizada" &&
        req.file
      ) {
        try {
          const resultado =
            await subirFotoEmergencia(
              req.file.buffer,
              reporteGuardado._id.toString()
            );

          reporteGuardado.foto = {
            url:
              resultado.secure_url,

            public_id:
              resultado.public_id,
          };

          await reporteGuardado.save();

          console.log(
            "📸 Foto guardada:",
            reporteGuardado._id.toString()
          );
        } catch (error) {
          console.error(
            "❌ Error Cloudinary:",
            error
          );

          await Emergencia.findByIdAndDelete(
            reporteGuardado._id
          );

          return res.status(500).json({
            error:
              "No fue posible guardar la fotografía. El reporte no fue creado.",
          });
        }
      }

      console.log(
        "================================="
      );

      console.log(
        "🚨 NUEVO REPORTE"
      );

      console.log(
        "ID:",
        reporteGuardado._id.toString()
      );

      console.log(
        "Departamento:",
        reporteGuardado.departamento
      );

      console.log(
        "Ciudad:",
        reporteGuardado.ciudad
      );

      console.log(
        "Tipo:",
        reporteGuardado.tipoReporte
      );

      console.log(
        "================================="
      );

      res.status(201).json({
        ok: true,

        mensaje:
          "Reporte registrado correctamente",

        reporte: {
          id:
            reporteGuardado._id,

          ciudad:
            reporteGuardado.ciudad,

          departamento:
            reporteGuardado.departamento,

          tipoReporte:
            reporteGuardado.tipoReporte,

          fecha:
            reporteGuardado.fechaCreacion,
        },
      });
    } catch (error) {
      console.error(
        "❌ ERROR CREANDO REPORTE:",
        error
      );

      res.status(500).json({
        ok: false,

        error:
          "Error interno del servidor",
      });
    }
  }
);

// =====================================================
// CONSULTAR REPORTES
// =====================================================
//
// Esta ruta sigue funcionando para las páginas
// de personas no localizadas y personas a salvo.
//
// =====================================================

app.get(
  "/api/emergencias",
  async (req, res) => {
    try {
      const filtro = {
        activa: true,
      };

      if (req.query.ciudad) {
        filtro.ciudad =
          req.query.ciudad;
      }

      if (req.query.tipoReporte) {
        filtro.tipoReporte =
          req.query.tipoReporte;
      }

      const reportes =
        await Emergencia
          .find(filtro)
          .sort({
            fechaCreacion: -1,
          });

      res.json({
        ok: true,

        total:
          reportes.length,

        reportes,
      });
    } catch (error) {
      console.error(
        "❌ ERROR CONSULTANDO REPORTES:",
        error
      );

      res.status(500).json({
        ok: false,

        error:
          "Error consultando los reportes",
      });
    }
  }
);

// =====================================================
// OBTENER UN REPORTE
// =====================================================

app.get(
  "/api/emergencias/:id",
  async (req, res) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          error: "ID inválido",
        });
      }

      const reporte =
        await Emergencia.findById(
          req.params.id
        );

      if (!reporte) {
        return res.status(404).json({
          error:
            "Reporte no encontrado",
        });
      }

      res.json({
        ok: true,
        reporte,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Error obteniendo reporte",
      });
    }
  }
);

// =====================================================
// ESTADÍSTICAS RESUMEN
// =====================================================

app.get(
  "/api/emergencias/estadisticas/resumen",
  async (req, res) => {
    try {
      const [
        total,
        porCiudad,
        porTipo,
        personas,
      ] = await Promise.all([
        Emergencia.countDocuments({
          activa: true,
        }),

        Emergencia.aggregate([
          {
            $match: {
              activa: true,
            },
          },

          {
            $group: {
              _id: "$ciudad",

              cantidad: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              cantidad: -1,
            },
          },
        ]),

        Emergencia.aggregate([
          {
            $match: {
              activa: true,
            },
          },

          {
            $group: {
              _id: "$tipoReporte",

              cantidad: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              cantidad: -1,
            },
          },
        ]),

        Emergencia.aggregate([
          {
            $match: {
              activa: true,
            },
          },

          {
            $group: {
              _id: null,

              personas: {
                $sum:
                  "$personasAfectadas",
              },
            },
          },
        ]),
      ]);

      res.json({
        ok: true,

        totalReportes: total,

        personasAfectadas:
          personas.length > 0
            ? personas[0].personas
            : 0,

        porCiudad,

        porTipo,
      });
    } catch (error) {
      console.error(
        "❌ ERROR ESTADÍSTICAS:",
        error
      );

      res.status(500).json({
        error:
          "Error obteniendo estadísticas",
      });
    }
  }
);

// =====================================================
// DASHBOARD PROFESIONAL
// =====================================================
//
// IMPORTANTE:
//
// Este endpoint devuelve información agregada.
// NO devuelve:
//
// - nombres
// - teléfonos
// - direcciones
// - fotografías
//
// Es la fuente de datos del dashboard.
// =====================================================

app.get(
  "/api/reportes/dashboard",
  async (req, res) => {
    try {
      const {
        departamento,
        ciudad,
        tipoReporte,
        fechaInicio,
        fechaFin,
      } = req.query;

      // =================================================
      // MATCH BASE
      // =================================================

      const match = {
        activa: true,
      };

      // =================================================
      // FILTRO CIUDAD
      // =================================================

      if (ciudad) {
        if (!MUNICIPIOS.includes(ciudad)) {
          return res.status(400).json({
            ok: false,
            error:
              "Municipio inválido",
          });
        }

        match.ciudad = ciudad;
      }

      // =================================================
      // FILTRO TIPO
      // =================================================

      if (tipoReporte) {
        if (
          !TIPOS_REPORTE.includes(
            tipoReporte
          )
        ) {
          return res.status(400).json({
            ok: false,
            error:
              "Tipo de reporte inválido",
          });
        }

        match.tipoReporte =
          tipoReporte;
      }

      // =================================================
      // FILTRO FECHA INICIO
      // =================================================

      if (fechaInicio) {
        const inicio = new Date(
          `${fechaInicio}T00:00:00`
        );

        if (isNaN(inicio.getTime())) {
          return res.status(400).json({
            ok: false,
            error:
              "fechaInicio inválida",
          });
        }

        match.fechaCreacion = {
          ...(match.fechaCreacion ||
            {}),
          $gte: inicio,
        };
      }

      // =================================================
      // FILTRO FECHA FIN
      // =================================================

      if (fechaFin) {
        const fin = new Date(
          `${fechaFin}T23:59:59.999`
        );

        if (isNaN(fin.getTime())) {
          return res.status(400).json({
            ok: false,
            error:
              "fechaFin inválida",
          });
        }

        match.fechaCreacion = {
          ...(match.fechaCreacion ||
            {}),
          $lte: fin,
        };
      }

      // =================================================
      // PIPELINE BASE
      // =================================================
      //
      // Usamos el campo departamento si existe.
      //
      // Para registros antiguos que no tengan
      // departamento, lo calculamos usando ciudad.
      //

      const pipelineBase = [
        {
          $match: match,
        },

        {
          $addFields: {
            departamentoDashboard: {
              $cond: [
                {
                  $and: [
                    {
                      $ne: [
                        "$departamento",
                        null,
                      ],
                    },

                    {
                      $ne: [
                        "$departamento",
                        "",
                      ],
                    },
                  ],
                },

                "$departamento",

                {
                  $switch: {
                    branches:
                      Object.entries(
                        DEPARTAMENTO_POR_MUNICIPIO
                      ).map(
                        ([
                          municipio,
                          departamento,
                        ]) => ({
                          case: {
                            $eq: [
                              "$ciudad",
                              municipio,
                            ],
                          },

                          then:
                            departamento,
                        })
                      ),

                    default:
                      "No identificado",
                  },
                },
              ],
            },
          },
        },
      ];

      // =================================================
      // FILTRO DEPARTAMENTO
      // =================================================

      if (departamento) {
        pipelineBase.push({
          $match: {
            departamentoDashboard:
              departamento,
          },
        });
      }

      // =================================================
      // AGREGACIONES
      // =================================================

      const [
        resumen,
        porDepartamento,
        porCiudad,
        porTipoReporte,
        porNecesidad,
        porEstadoVivienda,
        evolucion,
        ubicaciones,
      ] = await Promise.all([
        // =================================================
        // RESUMEN
        // =================================================

        Emergencia.aggregate([
          ...pipelineBase,

          {
            $group: {
              _id: null,

              totalReportes: {
                $sum: 1,
              },

              personasAfectadas: {
                $sum:
                  "$personasAfectadas",
              },

              personasASalvo: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$tipoReporte",
                        "Estoy a salvo",
                      ],
                    },

                    1,

                    0,
                  ],
                },
              },

              personasNoLocalizadas: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$tipoReporte",
                        "Persona no localizada",
                      ],
                    },

                    1,

                    0,
                  ],
                },
              },

              viviendasAfectadas: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$tipoReporte",
                        "Daños en mi vivienda",
                      ],
                    },

                    1,

                    0,
                  ],
                },
              },

              personasNecesitanAyuda: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$tipoReporte",
                        "Necesito ayuda",
                      ],
                    },

                    1,

                    0,
                  ],
                },
              },

              personasOfrecenAyuda: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$tipoReporte",
                        "Quiero ofrecer ayuda",
                      ],
                    },

                    1,

                    0,
                  ],
                },
              },
            },
          },
        ]),

        // =================================================
        // DEPARTAMENTOS
        // =================================================

        Emergencia.aggregate([
          ...pipelineBase,

          {
            $group: {
              _id:
                "$departamentoDashboard",

              reportes: {
                $sum: 1,
              },

              personasAfectadas: {
                $sum:
                  "$personasAfectadas",
              },

              noLocalizadas: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$tipoReporte",
                        "Persona no localizada",
                      ],
                    },

                    1,

                    0,
                  ],
                },
              },

              aSalvo: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$tipoReporte",
                        "Estoy a salvo",
                      ],
                    },

                    1,

                    0,
                  ],
                },
              },

              necesitanAyuda: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$tipoReporte",
                        "Necesito ayuda",
                      ],
                    },

                    1,

                    0,
                  ],
                },
              },

              viviendas: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$tipoReporte",
                        "Daños en mi vivienda",
                      ],
                    },

                    1,

                    0,
                  ],
                },
              },
            },
          },

          {
            $sort: {
              reportes: -1,
            },
          },
        ]),

        // =================================================
        // MUNICIPIOS
        // =================================================

        Emergencia.aggregate([
          ...pipelineBase,

          {
            $group: {
              _id: "$ciudad",

              departamento: {
                $first:
                  "$departamentoDashboard",
              },

              reportes: {
                $sum: 1,
              },

              personasAfectadas: {
                $sum:
                  "$personasAfectadas",
              },

              noLocalizadas: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$tipoReporte",
                        "Persona no localizada",
                      ],
                    },

                    1,

                    0,
                  ],
                },
              },

              aSalvo: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$tipoReporte",
                        "Estoy a salvo",
                      ],
                    },

                    1,

                    0,
                  ],
                },
              },

              necesitanAyuda: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$tipoReporte",
                        "Necesito ayuda",
                      ],
                    },

                    1,

                    0,
                  ],
                },
              },

              viviendas: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$tipoReporte",
                        "Daños en mi vivienda",
                      ],
                    },

                    1,

                    0,
                  ],
                },
              },
            },
          },

          {
            $sort: {
              reportes: -1,
            },
          },
        ]),

        // =================================================
        // TIPOS DE REPORTE
        // =================================================

        Emergencia.aggregate([
          ...pipelineBase,

          {
            $group: {
              _id: "$tipoReporte",

              cantidad: {
                $sum: 1,
              },

              personasAfectadas: {
                $sum:
                  "$personasAfectadas",
              },
            },
          },

          {
            $sort: {
              cantidad: -1,
            },
          },
        ]),

        // =================================================
        // NECESIDADES
        // =================================================

        Emergencia.aggregate([
          ...pipelineBase,

          {
            $unwind: {
              path: "$necesidades",
              preserveNullAndEmptyArrays:
                false,
            },
          },

          {
            $group: {
              _id: "$necesidades",

              cantidad: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              cantidad: -1,
            },
          },
        ]),

        // =================================================
        // ESTADO DE VIVIENDA
        // =================================================

        Emergencia.aggregate([
          ...pipelineBase,

          {
            $match: {
              tipoReporte:
                "Daños en mi vivienda",

              estadoVivienda: {
                $nin: ["", null],
              },
            },
          },

          {
            $group: {
              _id:
                "$estadoVivienda",

              cantidad: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              cantidad: -1,
            },
          },
        ]),

        // =================================================
        // EVOLUCIÓN DIARIA
        // =================================================

        Emergencia.aggregate([
          ...pipelineBase,

          {
            $group: {
              _id: {
                $dateToString: {
                  format:
                    "%Y-%m-%d",

                  date:
                    "$fechaCreacion",
                },
              },

              reportes: {
                $sum: 1,
              },

              personasAfectadas: {
                $sum:
                  "$personasAfectadas",
              },
            },
          },

          {
            $sort: {
              _id: 1,
            },
          },
        ]),

        // =================================================
        // DATOS PARA MAPA
        // =================================================
        //
        // SOLO registros que realmente tengan
        // coordenadas.
        //
        // No devolvemos información personal.
        //

        Emergencia.aggregate([
          ...pipelineBase,

          {
            $match: {
              latitud: {
                $ne: null,
              },

              longitud: {
                $ne: null,
              },
            },
          },

          {
            $project: {
              _id: 0,

              latitud: 1,

              longitud: 1,

              ciudad: 1,

              departamento:
                "$departamentoDashboard",

              tipoReporte: 1,

              personasAfectadas: 1,
            },
          },
        ]),
      ]);

      // =================================================
      // RESUMEN POR DEFECTO
      // =================================================

      const datosResumen =
        resumen[0] || {
          totalReportes: 0,

          personasAfectadas: 0,

          personasASalvo: 0,

          personasNoLocalizadas: 0,

          viviendasAfectadas: 0,

          personasNecesitanAyuda: 0,

          personasOfrecenAyuda: 0,
        };

      // =================================================
      // PORCENTAJES
      // =================================================

      const totalReportes =
        datosResumen.totalReportes || 0;

      const calcularPorcentaje = (
        valor
      ) => {
        if (!totalReportes) {
          return 0;
        }

        return Number(
          (
            (valor / totalReportes) *
            100
          ).toFixed(1)
        );
      };

      datosResumen.porcentajes = {
        aSalvo:
          calcularPorcentaje(
            datosResumen.personasASalvo
          ),

        noLocalizadas:
          calcularPorcentaje(
            datosResumen.personasNoLocalizadas
          ),

        viviendas:
          calcularPorcentaje(
            datosResumen.viviendasAfectadas
          ),

        necesitanAyuda:
          calcularPorcentaje(
            datosResumen.personasNecesitanAyuda
          ),

        ofrecenAyuda:
          calcularPorcentaje(
            datosResumen.personasOfrecenAyuda
          ),
      };

      // =================================================
      // INDICADORES
      // =================================================

      const municipioMasReportado =
        porCiudad.length
          ? porCiudad[0]
          : null;

      const departamentoMasReportado =
        porDepartamento.length
          ? porDepartamento[0]
          : null;

      const necesidadPrioritaria =
        porNecesidad.length
          ? porNecesidad[0]
          : null;

      // =================================================
      // ALERTAS
      // =================================================

      const alertas = [];

      if (
        datosResumen
          .personasNoLocalizadas > 0
      ) {
        alertas.push({
          nivel: "critico",

          tipo:
            "Personas no localizadas",

          cantidad:
            datosResumen
              .personasNoLocalizadas,

          mensaje:
            "Existen personas reportadas como no localizadas.",
        });
      }

      if (
        datosResumen
          .personasNecesitanAyuda > 0
      ) {
        alertas.push({
          nivel: "alto",

          tipo:
            "Personas que necesitan ayuda",

          cantidad:
            datosResumen
              .personasNecesitanAyuda,

          mensaje:
            "Existen reportes activos de personas que solicitan ayuda.",
        });
      }

      if (necesidadPrioritaria) {
        alertas.push({
          nivel: "medio",

          tipo:
            "Necesidad prioritaria",

          cantidad:
            necesidadPrioritaria.cantidad,

          necesidad:
            necesidadPrioritaria._id,

          mensaje:
            `La necesidad más reportada actualmente es ${necesidadPrioritaria._id}.`,
        });
      }

      if (municipioMasReportado) {
        alertas.push({
          nivel: "informativo",

          tipo:
            "Mayor concentración",

          cantidad:
            municipioMasReportado.reportes,

          municipio:
            municipioMasReportado._id,

          mensaje:
            `${municipioMasReportado._id} concentra actualmente la mayor cantidad de reportes.`,
        });
      }

      // =================================================
      // MUNICIPIOS CON PERSONAS NO LOCALIZADAS
      // =================================================

      const municipiosNoLocalizados =
        porCiudad.filter(
          (item) =>
            item.noLocalizadas > 0
        );

      // =================================================
      // MUNICIPIOS CON MAYOR NECESIDAD
      // =================================================

      const municipiosNecesitanAyuda =
        porCiudad
          .filter(
            (item) =>
              item.necesitanAyuda > 0
          )
          .sort(
            (a, b) =>
              b.necesitanAyuda -
              a.necesitanAyuda
          );

      // =================================================
      // RESPUESTA
      // =================================================

      res.json({
        ok: true,

        generadoEn:
          new Date().toISOString(),

        filtros: {
          departamento:
            departamento || "Todos",

          ciudad:
            ciudad || "Todos",

          tipoReporte:
            tipoReporte || "Todos",

          fechaInicio:
            fechaInicio || null,

          fechaFin:
            fechaFin || null,
        },

        resumen: datosResumen,

        indicadores: {
          municipioMasReportado,

          departamentoMasReportado,

          necesidadPrioritaria,

          municipiosNoLocalizados,

          municipiosNecesitanAyuda,
        },

        porDepartamento,

        porCiudad,

        porTipoReporte,

        porNecesidad,

        porEstadoVivienda,

        evolucion,

        ubicaciones,
      });
    } catch (error) {
      console.error(
        "❌ ERROR DASHBOARD:",
        error
      );

      res.status(500).json({
        ok: false,

        error:
          "Error generando el dashboard",

        detalle:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      });
    }
  }
);

// =====================================================
// 404
// =====================================================

app.use((req, res) => {
  res.status(404).json({
    error:
      "Ruta no encontrada",
  });
});

// =====================================================
// ERRORES MULTER
// =====================================================

app.use(
  (error, req, res, next) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          error:
            "La fotografía no puede superar los 5 MB",
        });
      }

      if (
        error.code ===
        "LIMIT_FILE_COUNT"
      ) {
        return res.status(400).json({
          error:
            "Solo se permite una fotografía",
        });
      }

      return res.status(400).json({
        error:
          "Error procesando la fotografía",
      });
    }

    if (error) {
      console.error(
        "❌ ERROR:",
        error
      );

      return res.status(400).json({
        error:
          error.message ||
          "Error procesando la solicitud",
      });
    }

    next();
  }
);

// =====================================================
// INICIAR SERVIDOR
// =====================================================

app.listen(PORT, () => {
  console.log("");

  console.log(
    "🇨🇴 ================================="
  );

  console.log(
    "🇨🇴 SISTEMA DE AYUDA CIUDADANA"
  );

  console.log(
    "🇨🇴 ================================="
  );

  console.log(
    `🚀 Puerto: ${PORT}`
  );

  console.log(
    "❤️ Health: /health"
  );

  console.log(
    "🚨 Reportes: /api/emergencias"
  );

  console.log(
    "📊 Estadísticas: /api/emergencias/estadisticas/resumen"
  );

  console.log(
    "📈 Dashboard: /api/reportes/dashboard"
  );

  console.log("");
});
