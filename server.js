const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

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
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(cookieParser());

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

// =====================================================
// SEGURIDAD
// =====================================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error:
      "Demasiados intentos de acceso. Intenta nuevamente más tarde.",
  },
});

// =====================================================
// AUTENTICACIÓN DE AUTORIDADES
// =====================================================

const verificarAdministrador = (req, res, next) => {
  try {
    const token = req.cookies?.admin_token;

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "No autorizado",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (
      decoded.username !==
      process.env.ADMIN_USERNAME
    ) {
      return res.status(403).json({
        ok: false,
        error: "Acceso denegado",
      });
    }

    req.admin = {
      username: decoded.username,
      rol: "autoridad",
    };

    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: "Sesión inválida o expirada",
    });
  }
};

// =====================================================
// MULTER
// =====================================================
// Una fotografía.
// Máximo 5 MB.
// Solo para personas no localizadas.

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
// MUNICIPIOS
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
// SCHEMA
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

    latitud: {
      type: Number,
      default: null,
    },

    longitud: {
      type: Number,
      default: null,
    },

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
// HEALTH
// =====================================================

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    servicio:
      "Sistema de Ayuda Ciudadana",
    fecha: new Date().toISOString(),
  });
});


// =====================================================
// LOGIN AUTORIDADES
// =====================================================

app.post(
  "/api/admin/login",
  loginLimiter,
  async (req, res) => {
    try {
      const {
        username,
        password,
      } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          ok: false,
          error:
            "Usuario y contraseña son obligatorios",
        });
      }

      if (
        !process.env.ADMIN_USERNAME ||
        !process.env.ADMIN_PASSWORD_HASH ||
        !process.env.JWT_SECRET
      ) {
        console.error(
          "❌ Faltan variables de seguridad en Render"
        );

        return res.status(500).json({
          ok: false,
          error:
            "El sistema de autenticación no está configurado",
        });
      }

      if (
        username !==
        process.env.ADMIN_USERNAME
      ) {
        return res.status(401).json({
          ok: false,
          error:
            "Credenciales incorrectas",
        });
      }

      const passwordCorrecta =
        await bcrypt.compare(
          password,
          process.env.ADMIN_PASSWORD_HASH
        );

      if (!passwordCorrecta) {
        return res.status(401).json({
          ok: false,
          error:
            "Credenciales incorrectas",
        });
      }

      const token = jwt.sign(
        {
          username,
          rol: "autoridad",
        },

        process.env.JWT_SECRET,

        {
          expiresIn: "8h",
        }
      );

      res.cookie(
        "admin_token",
        token,
        {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge:
            8 * 60 * 60 * 1000,
        }
      );

      return res.json({
        ok: true,
        mensaje:
          "Acceso autorizado",
      });
    } catch (error) {
      console.error(
        "❌ ERROR LOGIN:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Error interno del servidor",
      });
    }
  }
);

// =====================================================
// VERIFICAR SESIÓN
// =====================================================

app.get(
  "/api/admin/me",
  verificarAdministrador,
  (req, res) => {
    res.json({
      ok: true,
      usuario:
        req.admin.username,
      rol: req.admin.rol,
    });
  }
);

// =====================================================
// CERRAR SESIÓN
// =====================================================

app.post(
  "/api/admin/logout",
  (req, res) => {
    res.clearCookie(
      "admin_token",
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      }
    );

    res.json({
      ok: true,
      mensaje:
        "Sesión cerrada",
    });
  }
);

// =====================================================
// MUNICIPIOS
// =====================================================

app.get(
  "/api/municipios",
  (req, res) => {
    res.json(MUNICIPIOS);
  }
);

// =====================================================
// DEPARTAMENTOS
// =====================================================

app.get(
  "/api/departamentos",
  (req, res) => {
    const departamentos = [
      ...new Set(
        Object.values(
          DEPARTAMENTO_POR_MUNICIPIO
        )
      ),
    ].sort();

    res.json(departamentos);
  }
);

// =====================================================
// TIPOS DE REPORTE
// =====================================================

app.get(
  "/api/tipos-reporte",
  (req, res) => {
    res.json(TIPOS_REPORTE);
  }
);

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

      if (!nombre || !nombre.trim()) {
        return res.status(400).json({
          error:
            "El nombre es obligatorio",
        });
      }

      if (!ciudad) {
        return res.status(400).json({
          error:
            "La ciudad es obligatoria",
        });
      }

      if (
        !MUNICIPIOS.includes(ciudad)
      ) {
        return res.status(400).json({
          error:
            "El municipio seleccionado no está habilitado",
        });
      }

      if (
        !direccion ||
        !direccion.trim()
      ) {
        return res.status(400).json({
          error:
            "La dirección es obligatoria",
        });
      }

      if (!tipoReporte) {
        return res.status(400).json({
          error:
            "El tipo de reporte es obligatorio",
        });
      }

      if (
        !TIPOS_REPORTE.includes(
          tipoReporte
        )
      ) {
        return res.status(400).json({
          error:
            "Tipo de reporte inválido",
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

      if (
        !descripcion ||
        !descripcion.trim()
      ) {
        return res.status(400).json({
          error:
            "La descripción es obligatoria",
        });
      }

      // FOTO SOLO PARA NO LOCALIZADOS

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

      // NECESIDADES

      let necesidadesArray = [];

      if (necesidades) {
        try {
          necesidadesArray =
            typeof necesidades ===
            "string"
              ? JSON.parse(
                  necesidades
                )
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

      const departamento =
        DEPARTAMENTO_POR_MUNICIPIO[
          ciudad
        ] || "";

      const nuevoReporte =
        new Emergencia({
          nombre:
            nombre.trim(),

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

      // FOTO

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
        } catch (error) {
          console.error(
            "❌ ERROR CLOUDINARY:",
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
        "🚨 NUEVO REPORTE:",
        reporteGuardado._id.toString(),
        reporteGuardado.ciudad,
        reporteGuardado.tipoReporte
      );

      return res.status(201).json({
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

      return res.status(500).json({
        ok: false,
        error:
          "Error interno del servidor",
      });
    }
  }
);

// =====================================================
// PÚBLICO: PERSONAS NO LOCALIZADAS
// =====================================================
// IMPORTANTE:
// Solo mostramos información necesaria para ayudar.
// NO mostramos teléfono ni dirección.

app.get(
  "/api/public/desaparecidos",
  async (req, res) => {
    try {
      const filtro = {
        activa: true,

        tipoReporte:
          "Persona no localizada",
      };

      if (req.query.ciudad) {
        if (
          !MUNICIPIOS.includes(
            req.query.ciudad
          )
        ) {
          return res.status(400).json({
            ok: false,
            error:
              "Municipio inválido",
          });
        }

        filtro.ciudad =
          req.query.ciudad;
      }

      const reportes =
        await Emergencia.find(filtro)
          .select(
            "_id nombre ciudad departamento tipoReporte descripcion foto fechaCreacion activa"
          )
          .sort({
            fechaCreacion: -1,
          });

      return res.json({
        ok: true,
        total:
          reportes.length,
        reportes,
      });
    } catch (error) {
      console.error(
        "❌ ERROR DESAPARECIDOS:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Error consultando personas no localizadas",
      });
    }
  }
);

// =====================================================
// PÚBLICO: PERSONAS A SALVO
// =====================================================

app.get(
  "/api/public/salvos",
  async (req, res) => {
    try {
      const filtro = {
        activa: true,

        tipoReporte:
          "Estoy a salvo",
      };

      if (req.query.ciudad) {
        if (
          !MUNICIPIOS.includes(
            req.query.ciudad
          )
        ) {
          return res.status(400).json({
            ok: false,
            error:
              "Municipio inválido",
          });
        }

        filtro.ciudad =
          req.query.ciudad;
      }

      const reportes =
        await Emergencia.find(filtro)
          .select(
            "_id nombre ciudad departamento tipoReporte descripcion fechaCreacion activa"
          )
          .sort({
            fechaCreacion: -1,
          });

      return res.json({
        ok: true,
        total:
          reportes.length,
        reportes,
      });
    } catch (error) {
      console.error(
        "❌ ERROR SALVOS:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Error consultando personas a salvo",
      });
    }
  }
);

// =====================================================
// DASHBOARD DE AUTORIDADES
// =====================================================
// 🔐 PROTEGIDO
//
// No contiene nombres, teléfonos,
// direcciones ni fotografías.

app.get(
  "/api/reportes/dashboard",
  verificarAdministrador,
  async (req, res) => {
    try {
      const {
        departamento,
        ciudad,
        tipoReporte,
        fechaInicio,
        fechaFin,
      } = req.query;

      const match = {
        activa: true,
      };

      // CIUDAD

      if (ciudad) {
        if (
          !MUNICIPIOS.includes(ciudad)
        ) {
          return res.status(400).json({
            ok: false,
            error:
              "Municipio inválido",
          });
        }

        match.ciudad = ciudad;
      }

      // TIPO

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

      // FECHA INICIO

      if (fechaInicio) {
        const inicio = new Date(
          `${fechaInicio}T00:00:00`
        );

        if (
          isNaN(inicio.getTime())
        ) {
          return res.status(400).json({
            ok: false,
            error:
              "fechaInicio inválida",
          });
        }

        match.fechaCreacion = {
          $gte: inicio,
        };
      }

      // FECHA FIN

      if (fechaFin) {
        const fin = new Date(
          `${fechaFin}T23:59:59.999`
        );

        if (
          isNaN(fin.getTime())
        ) {
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

      // PIPELINE

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
        // RESUMEN

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

        // DEPARTAMENTOS

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

        // CIUDADES

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

        // TIPOS

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

        // NECESIDADES

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

        // VIVIENDAS

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

        // EVOLUCIÓN

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

        // MAPA

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
      // RESUMEN
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

      const totalReportes =
        datosResumen.totalReportes ||
        0;

      const calcularPorcentaje = (
        valor
      ) => {
        if (!totalReportes) {
          return 0;
        }

        return Number(
          (
            (valor /
              totalReportes) *
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
        datosResumen.personasNoLocalizadas >
        0
      ) {
        alertas.push({
          nivel: "critico",
          tipo:
            "Personas no localizadas",
          cantidad:
            datosResumen.personasNoLocalizadas,
          mensaje:
            "Existen personas reportadas como no localizadas.",
        });
      }

      if (
        datosResumen.personasNecesitanAyuda >
        0
      ) {
        alertas.push({
          nivel: "alto",
          tipo:
            "Personas que necesitan ayuda",
          cantidad:
            datosResumen.personasNecesitanAyuda,
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
          nivel:
            "informativo",
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

      const municipiosNoLocalizados =
        porCiudad.filter(
          (item) =>
            item.noLocalizadas > 0
        );

      const municipiosNecesitanAyuda =
        porCiudad
          .filter(
            (item) =>
              item.necesitanAyuda >
              0
          )
          .sort(
            (a, b) =>
              b.necesitanAyuda -
              a.necesitanAyuda
          );

      // =================================================
      // RESPUESTA DASHBOARD
      // =================================================

      return res.json({
        ok: true,

        generadoEn:
          new Date().toISOString(),

        filtros: {
          departamento:
            departamento ||
            "Todos",

          ciudad:
            ciudad || "Todos",

          tipoReporte:
            tipoReporte ||
            "Todos",

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

          alertas,
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

      return res.status(500).json({
        ok: false,
        error:
          "Error generando el dashboard",
      });
    }
  }
);

// =====================================================
// BASE DE DATOS PRIVADA PARA AUTORIDADES
// =====================================================
// 🔐 AQUÍ SÍ ESTÁ TODA LA INFORMACIÓN.
//
// Esta ruta NO se puede consultar sin login.
//
// Permite:
// - búsqueda
// - ciudad
// - departamento
// - tipo
// - fechas
// - paginación
//
// La información completa solo sale después
// de autenticar la sesión.
// =====================================================

app.get(
  "/api/reportes/detallados",
  verificarAdministrador,
  async (req, res) => {
    try {
      const {
        pagina = 1,
        limite = 50,
        buscar,
        ciudad,
        departamento,
        tipoReporte,
        activa,
        fechaInicio,
        fechaFin,
      } = req.query;

      const paginaNumero = Math.max(
        parseInt(pagina, 10) || 1,
        1
      );

      const limiteNumero = Math.min(
        Math.max(
          parseInt(limite, 10) || 50,
          1
        ),
        100
      );

      const filtro = {};

      // CIUDAD

      if (ciudad) {
        if (
          !MUNICIPIOS.includes(ciudad)
        ) {
          return res.status(400).json({
            ok: false,
            error:
              "Municipio inválido",
          });
        }

        filtro.ciudad = ciudad;
      }

      // DEPARTAMENTO

      if (departamento) {
        filtro.departamento =
          departamento;
      }

      // TIPO

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

        filtro.tipoReporte =
          tipoReporte;
      }

      // ACTIVA

      if (activa !== undefined) {
        filtro.activa =
          activa === "true";
      }

      // FECHAS

      if (
        fechaInicio ||
        fechaFin
      ) {
        filtro.fechaCreacion = {};

        if (fechaInicio) {
          const inicio = new Date(
            `${fechaInicio}T00:00:00`
          );

          if (
            isNaN(inicio.getTime())
          ) {
            return res.status(
              400
            ).json({
              ok: false,
              error:
                "fechaInicio inválida",
            });
          }

          filtro.fechaCreacion.$gte =
            inicio;
        }

        if (fechaFin) {
          const fin = new Date(
            `${fechaFin}T23:59:59.999`
          );

          if (
            isNaN(fin.getTime())
          ) {
            return res.status(
              400
            ).json({
              ok: false,
              error:
                "fechaFin inválida",
            });
          }

          filtro.fechaCreacion.$lte =
            fin;
        }
      }

      // BÚSQUEDA

      if (
        buscar &&
        buscar.trim()
      ) {
        const termino =
          buscar.trim();

        filtro.$or = [
          {
            nombre: {
              $regex:
                termino,
              $options: "i",
            },
          },

          {
            telefonoWhatsapp: {
              $regex:
                termino,
              $options: "i",
            },
          },

          {
            direccion: {
              $regex:
                termino,
              $options: "i",
            },
          },

          {
            descripcion: {
              $regex:
                termino,
              $options: "i",
            },
          },
        ];
      }

      const skip =
        (paginaNumero - 1) *
        limiteNumero;

      const [
        total,
        reportes,
      ] = await Promise.all([
        Emergencia.countDocuments(
          filtro
        ),

        Emergencia.find(filtro)
          .sort({
            fechaCreacion: -1,
          })
          .skip(skip)
          .limit(limiteNumero)
          .lean(),
      ]);

      const totalPaginas =
        Math.ceil(
          total / limiteNumero
        );

      return res.json({
        ok: true,

        pagina: paginaNumero,

        limite: limiteNumero,

        total,

        totalPaginas,

        reportes,
      });
    } catch (error) {
      console.error(
        "❌ ERROR REPORTES DETALLADOS:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Error consultando la información privada",
      });
    }
  }
);

// =====================================================
// REPORTE INDIVIDUAL PRIVADO
// =====================================================
// 🔐 Información completa de un reporte.

app.get(
  "/api/reportes/detallados/:id",
  verificarAdministrador,
  async (req, res) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          ok: false,
          error: "ID inválido",
        });
      }

      const reporte =
        await Emergencia.findById(
          req.params.id
        ).lean();

      if (!reporte) {
        return res.status(404).json({
          ok: false,
          error:
            "Reporte no encontrado",
        });
      }

      return res.json({
        ok: true,
        reporte,
      });
    } catch (error) {
      console.error(
        "❌ ERROR REPORTE PRIVADO:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Error obteniendo el reporte",
      });
    }
  }
);

// =====================================================
// MARCAR REPORTE COMO INACTIVO
// =====================================================
// 🔐 Solo autoridades.
//
// Esto permite cerrar un caso,
// por ejemplo cuando una persona
// ya fue localizada.
//
// =====================================================

app.patch(
  "/api/reportes/detallados/:id/estado",
  verificarAdministrador,
  async (req, res) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          ok: false,
          error: "ID inválido",
        });
      }

      const {
        activa,
      } = req.body;

      if (
        typeof activa !==
        "boolean"
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "El campo activa debe ser booleano",
        });
      }

      const reporte =
        await Emergencia.findByIdAndUpdate(
          req.params.id,

          {
            $set: {
              activa,
            },
          },

          {
            new: true,
          }
        ).lean();

      if (!reporte) {
        return res.status(404).json({
          ok: false,
          error:
            "Reporte no encontrado",
        });
      }

      return res.json({
        ok: true,

        mensaje:
          activa
            ? "Reporte activado"
            : "Reporte cerrado",

        reporte,
      });
    } catch (error) {
      console.error(
        "❌ ERROR ACTUALIZANDO ESTADO:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Error actualizando el reporte",
      });
    }
  }
);

// =====================================================
// 404
// =====================================================

app.use(
  (req, res) => {
    res.status(404).json({
      ok: false,
      error:
        "Ruta no encontrada",
    });
  }
);

// =====================================================
// ERRORES MULTER
// =====================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "La fotografía no puede superar los 5 MB",
        });
      }

      if (
        error.code ===
        "LIMIT_FILE_COUNT"
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Solo se permite una fotografía",
        });
      }

      return res.status(400).json({
        ok: false,
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
        ok: false,
        error:
          error.message ||
          "Error procesando la solicitud",
      });
    }

    next();
  }
);

// =====================================================
// SERVIDOR
// =====================================================

app.listen(
  PORT,
  () => {
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
      "📝 Crear reporte: /api/emergencias"
    );

    console.log(
      "👤 Público desaparecidos: /api/public/desaparecidos"
    );

    console.log(
      "❤️ Público salvos: /api/public/salvos"
    );

    console.log(
      "🔐 Login autoridades: /api/admin/login"
    );

    console.log(
      "📊 Dashboard privado: /api/reportes/dashboard"
    );

    console.log(
      "🗄️ Base privada: /api/reportes/detallados"
    );

    console.log("");
  }
);
