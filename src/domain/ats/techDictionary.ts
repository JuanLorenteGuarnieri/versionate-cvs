/**
 * Diccionario de tecnologías conocidas, para dar más peso a las keywords
 * de una oferta que son tecnologías/herramientas/requisitos técnicos
 * concretos frente a palabras genéricas del anuncio (petición explícita
 * del usuario). Deliberadamente una lista de reglas fijas, no un modelo —
 * "no hace falta complicarse la existencia": cada término se compara tal
 * cual contra el token ya normalizado (minúsculas, sin acentos) que
 * produce `tokenize()`, así que aquí todo va en minúsculas y sin acentos.
 *
 * Solo términos de UN token: el resto del motor de keywords no reconoce
 * frases de varias palabras (decisión ya documentada en el estudio de la
 * sesión 11 — implementar n-gramas era mucho esfuerzo para un beneficio
 * incierto), así que términos como "computer vision" o "machine learning"
 * no pueden incluirse tal cual — se cubren sus componentes más
 * específicos por separado cuando tiene sentido (p.ej. "cnn", "yolo",
 * "opencv" sí aportan señal por sí solos).
 *
 * Organizado por categorías para poder mantenerlo/ampliarlo con cabeza.
 * Con más de mil entradas entre todas las categorías, centrado sobre todo
 * en IA/computer vision/machine learning/robótica/gráficos por computador
 * (petición explícita), más un catálogo amplio de desarrollo de software
 * general (lenguajes, frameworks, bases de datos, DevOps...) porque una
 * oferta rara vez pide solo tecnologías de IA sin nada más alrededor.
 */

const PROGRAMMING_LANGUAGES = [
  "python", "java", "javascript", "typescript", "c", "c++", "c#", "go", "golang", "rust", "ruby",
  "php", "swift", "kotlin", "scala", "r", "matlab", "julia", "perl", "lua", "haskell", "dart",
  "elixir", "erlang", "clojure", "groovy", "fortran", "cobol", "pascal", "delphi", "vhdl",
  "verilog", "bash", "shell", "powershell", "sql", "plsql", "tsql", "assembly", "prolog", "scheme",
  "racket", "ocaml", "fsharp", "f#", "objective-c", "objectivec", "crystal", "nim", "zig", "solidity",
  "vyper", "sas", "abap", "apex", "vba", "coffeescript", "webassembly", "wasm",
];

const WEB_FRONTEND = [
  "html", "css", "sass", "scss", "less", "react", "reactjs", "angular", "angularjs", "vue", "vuejs",
  "svelte", "sveltekit", "nextjs", "nuxt", "nuxtjs", "remix", "gatsby", "astro", "jquery",
  "bootstrap", "tailwind", "tailwindcss", "materialui", "mui", "chakraui", "antd", "webpack",
  "vite", "babel", "eslint", "prettier", "redux", "mobx", "zustand", "rxjs", "d3", "d3js",
  "threejs", "webgl2", "pixijs", "storybook", "jquery", "ember", "backbone", "polymer", "lit",
  "stimulus", "htmx", "alpinejs", "jest", "vitest", "cypress", "playwright", "puppeteer",
];

const BACKEND_FRAMEWORKS = [
  "node", "nodejs", "express", "expressjs", "nestjs", "koa", "fastify", "django", "flask",
  "fastapi", "pyramid", "tornado", "spring", "springboot", "hibernate", "struts", "quarkus",
  "micronaut", "rails", "sinatra", "laravel", "symfony", "codeigniter", "cakephp", "aspnet",
  "dotnet", ".net", "blazor", "gin", "echo", "fiber", "actix", "rocket", "phoenix", "grpc",
  "graphql", "apollo", "hasura", "strapi", "sanity", "wordpress", "drupal", "joomla", "magento",
  "shopify", "prestashop", "woocommerce",
];

const DATABASES = [
  "mysql", "postgresql", "postgres", "mongodb", "redis", "sqlite", "oracle", "mssql",
  "sqlserver", "cassandra", "dynamodb", "elasticsearch", "opensearch", "neo4j", "influxdb",
  "mariadb", "couchdb", "couchbase", "firebase", "firestore", "supabase", "cockroachdb",
  "timescaledb", "clickhouse", "snowflake", "bigquery", "redshift", "athena", "presto", "hive",
  "memcached", "rethinkdb", "arangodb", "faunadb", "planetscale", "prisma", "sequelize",
  "typeorm", "mongoose", "sqlalchemy", "knex",
];

const DEVOPS_CLOUD = [
  "docker", "kubernetes", "k8s", "helm", "aws", "azure", "gcp", "terraform", "ansible", "puppet",
  "chef", "jenkins", "gitlab", "github", "bitbucket", "circleci", "travis", "argocd", "flux",
  "istio", "linkerd", "prometheus", "grafana", "datadog", "splunk", "elk", "logstash", "kibana",
  "fluentd", "nginx", "apache", "tomcat", "linux", "ubuntu", "debian", "centos", "redhat", "rhel",
  "fedora", "alpine", "vagrant", "openstack", "openshift", "vmware", "vsphere", "cloudformation",
  "pulumi", "packer", "consul", "vault", "nomad", "rabbitmq", "kafka", "activemq", "zookeeper",
  "ec2", "s3", "lambda", "cloudfront", "eks", "ecs", "fargate", "rds", "sagemaker", "cloudwatch",
  "iam", "vpc", "route53", "sns", "sqs", "aks", "gke", "cicd", "gitops", "sre", "devsecops",
];

const AI_ML_CORE = [
  "tensorflow", "pytorch", "keras", "scikitlearn", "sklearn", "xgboost", "lightgbm", "catboost",
  "pandas", "numpy", "scipy", "matplotlib", "seaborn", "plotly", "jax", "flax", "huggingface",
  "transformers", "langchain", "llamaindex", "openai", "anthropic", "mlflow", "kubeflow", "onnx",
  "onnxruntime", "cuda", "cudnn", "tensorrt", "theano", "caffe", "caffe2", "mxnet", "paddlepaddle",
  "spark", "pyspark", "hadoop", "airflow", "dagster", "prefect", "dvc", "wandb", "optuna", "ray",
  "dask", "polars", "statsmodels", "gensim", "nltk", "spacy", "fasttext", "word2vec", "glove",
  "annoy", "faiss", "pinecone", "weaviate", "milvus", "chromadb", "qdrant",
];

const AI_ML_CONCEPTS = [
  "ml", "ai", "dl", "nlp", "nlu", "nlg", "cnn", "rnn", "lstm", "gru", "gan", "vae", "autoencoder",
  "transformer", "attention", "resnet", "vgg", "inception", "mobilenet", "efficientnet",
  "densenet", "unet", "bert", "gpt", "llm", "llms", "rag", "finetuning", "finetune", "pretraining",
  "embeddings", "embedding", "tokenization", "tokenizer", "backpropagation", "gradient",
  "regularization", "dropout", "batchnorm", "hyperparameter", "hyperparameters", "overfitting",
  "underfitting", "crossvalidation", "ensemble", "bagging", "boosting", "clustering", "kmeans",
  "dbscan", "pca", "svd", "svm", "knn", "regression", "classification", "reinforcement",
  "qlearning", "dqn", "ppo", "a3c", "montecarlo", "bayesian", "mcmc", "diffusion",
  "stablediffusion", "midjourney", "dalle", "generative", "multimodal", "distillation",
  "quantization", "pruning", "onnx", "mlops", "featureengineering", "labeling", "annotation",
];

const COMPUTER_VISION = [
  "opencv", "pcl", "vtk", "itk", "open3d", "detectron", "detectron2", "mmdetection",
  "albumentations", "dlib", "mediapipe", "simplecv", "yolo", "yolov5", "yolov8", "ssd",
  "fasterrcnn", "maskrcnn", "retinanet", "segmentation", "detection", "tracking", "slam",
  "orbslam", "pointcloud", "lidar", "stereo", "photogrammetry", "sfm", "calibration", "homography",
  "opticalflow", "featurematching", "sift", "surf", "orb", "hog", "haar", "ocr", "tesseract",
  "easyocr", "paddleocr", "facial", "biometrics", "reid", "pose", "openpose", "mediapipe",
  "depthmap", "voxel", "mesh", "meshing",
];

const ROBOTICS = [
  "ros", "ros2", "gazebo", "moveit", "urdf", "px4", "ardupilot", "arduino", "raspberrypi",
  "jetson", "stm32", "esp32", "fpga", "asic", "simulink", "vrep", "coppeliasim", "webots",
  "rtos", "freertos", "ethercat", "canbus", "modbus", "profinet", "plc", "scada", "hmi",
  "kinematics", "dynamics", "servo", "actuator", "encoder", "imu", "gyroscope", "accelerometer",
  "manipulator", "gripper", "endeffector", "trajectory", "pathplanning", "motionplanning",
  "controltheory", "pid", "kalman", "ekf", "particlefilter", "navigation", "localization",
  "mapping", "autonomy", "autonomous", "drone", "uav", "uav", "quadcopter", "exoskeleton",
  "cobots", "cobot",
];

const COMPUTER_GRAPHICS = [
  "opengl", "vulkan", "directx", "metal", "webgl", "glsl", "hlsl", "shader", "shaders",
  "raytracing", "pathtracing", "rasterization", "rendering", "renderer", "unity", "unrealengine",
  "unreal", "blender", "maya", "zbrush", "houdini", "substance", "autodesk", "cinema4d", "godot",
  "cryengine", "pbr", "vfx", "cgi", "rigging", "skinning", "animation", "tessellation", "voxel",
  "polygon", "texturing", "uv", "compositing", "nuke", "aftereffects", "colorgrading",
  "photogrammetry", "particlesystem", "physicsengine", "havok", "physx", "collisiondetection",
  "occlusion", "antialiasing", "bloom", "ssao", "lod", "skybox", "normalmap", "bumpmap",
  "displacement", "subsurface",
];

const MOBILE = [
  "android", "ios", "xamarin", "flutter", "reactnative", "swiftui", "uikit", "cordova", "ionic",
  "kotlinmultiplatform", "jetpackcompose", "capacitor",
];

const HARDWARE = [
  "gpu", "cpu", "tpu", "npu", "nvidia", "amd", "intel", "cuda", "opencl", "vulkan", "risc",
  "riscv", "arm", "x86", "embedded", "microcontroller", "microprocessor", "soc", "vhdl",
  "verilog", "asic",
];

const PROTOCOLS_FORMATS = [
  "rest", "restful", "graphql", "grpc", "websocket", "websockets", "json", "xml", "yaml",
  "protobuf", "mqtt", "tcp", "udp", "http", "https", "oauth", "oauth2", "jwt", "soap", "rpc",
  "amqp", "sse", "webrtc",
];

const TOOLS_GENERAL = [
  "git", "svn", "jira", "confluence", "slack", "figma", "sketch", "postman", "insomnia",
  "vscode", "intellij", "pycharm", "eclipse", "vim", "neovim", "emacs", "xcode", "androidstudio",
  "notion", "trello", "asana", "linear", "swagger", "openapi",
];

const METHODOLOGIES = [
  "agile", "scrum", "kanban", "devops", "devsecops", "tdd", "bdd", "ddd", "microservices",
  "microservicios", "monolith", "serverless", "eventdriven", "cicd",
];

const AI_ML_TOOLING_EXTRA = [
  "kornia", "torchvision", "torchaudio", "timm", "ultralytics", "supervision", "cvat", "labelimg",
  "labelme", "roboflow", "mlserver", "torchserve", "tfserving", "seldon", "bentoml", "streamlit",
  "gradio", "dash", "bokeh", "altair", "shap", "lime", "eli5", "imbalancedlearn", "featuretools",
  "h2o", "autokeras", "autosklearn", "hyperopt", "nevergrad", "stablebaselines3", "gym",
  "gymnasium", "mujoco", "isaacgym", "isaacsim", "carla", "airsim", "habitat", "minigrid",
];

const COMPUTER_VISION_MODELS = [
  "vgg16", "vgg19", "alexnet", "googlenet", "squeezenet", "shufflenet", "regnet", "convnext",
  "vit", "swin", "detr", "sam", "clip", "dino", "byol", "simclr", "moco", "nerf", "gaussiansplatting",
];

const ROBOTICS_EXTRA = [
  "ros1", "moveit2", "nav2", "tf2", "rviz", "rqt", "catkin", "colcon", "actionlib", "dynamixel",
  "ur5", "ur10", "kuka", "abb", "fanuc", "staubli", "cobotta", "franka", "moveo",
];

const COMPUTER_GRAPHICS_EXTRA = [
  "usd", "gltf", "fbx", "collada", "opensubdiv", "embree", "optix", "mdl", "osl", "renderman",
  "arnold", "vray", "corona", "keyshot", "marmoset", "substancepainter", "substancedesigner",
  "quixel", "megascans", "nanite", "lumen",
];

const WEB_GENERAL_EXTRA = [
  "deno", "bun", "solidjs", "qwik", "trpc", "drizzle", "turborepo", "nx", "lerna", "pnpm", "yarn",
  "npm",
];

const DEVOPS_EXTRA = [
  "argo", "spinnaker", "tekton", "crossplane", "karpenter", "cilium", "calico", "envoy", "traefik",
  "caddy", "haproxy",
];

const DATABASES_EXTRA = ["duckdb", "questdb", "tigerbeetle", "surrealdb", "edgedb"];

const LANGUAGES_EXTRA = ["odin", "gleam", "mojo"];

/**
 * Todo lo anterior, en un único set normalizado (minúsculas, sin acentos —
 * ya lo están todas, pero se pasa por seguridad si algún día se añade algo
 * con tilde por error).
 */
export const TECH_KEYWORDS: ReadonlySet<string> = new Set(
  [
    ...PROGRAMMING_LANGUAGES,
    ...WEB_FRONTEND,
    ...BACKEND_FRAMEWORKS,
    ...DATABASES,
    ...DEVOPS_CLOUD,
    ...AI_ML_CORE,
    ...AI_ML_CONCEPTS,
    ...COMPUTER_VISION,
    ...ROBOTICS,
    ...COMPUTER_GRAPHICS,
    ...MOBILE,
    ...HARDWARE,
    ...PROTOCOLS_FORMATS,
    ...TOOLS_GENERAL,
    ...METHODOLOGIES,
    ...AI_ML_TOOLING_EXTRA,
    ...COMPUTER_VISION_MODELS,
    ...ROBOTICS_EXTRA,
    ...COMPUTER_GRAPHICS_EXTRA,
    ...WEB_GENERAL_EXTRA,
    ...DEVOPS_EXTRA,
    ...DATABASES_EXTRA,
    ...LANGUAGES_EXTRA,
  ].map((t) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
  )
);

/** Cuánto más pesa una mención de una tecnología reconocida frente a una palabra cualquiera de la oferta — ver `ats/jobComparison.ts` y `domain/jobMatching.ts`. Un múltiplo simple y fácil de razonar, no hace falta más precisión que esta ("no hace falta complicarse la existencia"). */
export const TECH_KEYWORD_WEIGHT_MULTIPLIER = 3;

/** El token ya debe venir normalizado igual que lo hace `tokenize()` (minúsculas, sin acentos) — no vuelve a normalizar aquí para no encarecer cada comprobación. */
export function isTechKeyword(normalizedToken: string): boolean {
  return TECH_KEYWORDS.has(normalizedToken);
}
