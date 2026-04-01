(function () {
  const THREE_VERSION = "0.128.0";
  const THREE_SRC = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  const ORBIT_CONTROLS_SRC =
    "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }

        existing.addEventListener("load", function () {
          resolve();
        });
        existing.addEventListener("error", reject);
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.addEventListener("load", function () {
        script.dataset.loaded = "true";
        resolve();
      });
      script.addEventListener("error", reject);
      document.head.appendChild(script);
    });
  }

  function ensureRuntime() {
    const needsThree = typeof window.THREE === "undefined";
    const needsOrbitControls = !window.THREE || typeof window.THREE.OrbitControls === "undefined";

    let chain = Promise.resolve();

    if (needsThree) {
      chain = chain.then(function () {
        return loadScript(THREE_SRC);
      });
    }

    if (needsOrbitControls) {
      chain = chain.then(function () {
        return loadScript(ORBIT_CONTROLS_SRC);
      });
    }

    return chain.then(function () {
      if (!window.THREE) {
        throw new Error("Three.js failed to load.");
      }
      if (!window.THREE.OrbitControls) {
        throw new Error("OrbitControls failed to load.");
      }
      return window.THREE;
    });
  }

  function buildNode(THREE, data) {
    let object;

    if (data.mesh) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.mesh.positions, 3));
      geometry.computeVertexNormals();

      const materialData = data.mesh.material || {};
      const material = new THREE.MeshStandardMaterial({
        color: materialData.color !== undefined ? materialData.color : 0xffffff,
        roughness: materialData.roughness !== undefined ? materialData.roughness : 0.5,
        metalness: materialData.metalness !== undefined ? materialData.metalness : 0,
        transparent: Boolean(materialData.transparent),
        opacity: materialData.opacity !== undefined ? materialData.opacity : 1
      });

      object = new THREE.Mesh(geometry, material);
    } else {
      object = new THREE.Group();
    }

    object.name = data.name || "";
    if (data.position) {
      object.position.fromArray(data.position);
    }
    if (data.rotation) {
      object.rotation.set(data.rotation[0], data.rotation[1], data.rotation[2]);
    }
    if (data.scale) {
      object.scale.fromArray(data.scale);
    }

    (data.children || []).forEach(function (child) {
      object.add(buildNode(THREE, child));
    });

    return object;
  }

  function mountScene(container, sceneData) {
    const THREE = window.THREE;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(sceneData.background || 0x07111f, 0.05);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2.8, 8.5);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1.1, 0);

    scene.add(new THREE.HemisphereLight(0xb5d9ff, 0x0d1421, 1.5));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x5df2c4, 1.2);
    rimLight.position.set(-5, 4, -4);
    scene.add(rimLight);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(12, 80),
      new THREE.MeshStandardMaterial({
        color: 0x091626,
        metalness: 0.15,
        roughness: 0.88,
        transparent: true,
        opacity: 0.9
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    scene.add(ground);

    (sceneData.objects || []).forEach(function (item) {
      scene.add(buildNode(THREE, item));
    });

    function resize() {
      const nextWidth = container.clientWidth || 800;
      const nextHeight = container.clientHeight || 600;
      renderer.setSize(nextWidth, nextHeight, false);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    }

    window.addEventListener("resize", resize);

    function tick() {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }

    tick();
    resize();
  }

  function initContainer(container) {
    const sceneUrl = container.getAttribute("data-three-nocode-scene");
    if (!sceneUrl) {
      return;
    }

    fetch(sceneUrl)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to load scene JSON.");
        }
        return response.json();
      })
      .then(function (sceneData) {
        mountScene(container, sceneData);
      })
      .catch(function (error) {
        container.innerHTML =
          '<div style="padding:16px;color:#fff;background:#08111b;border:1px solid rgba(255,255,255,0.08);border-radius:12px;font-family:Arial,sans-serif;">' +
          "Viewer error: " +
          error.message +
          "</div>";
      });
  }

  function init() {
    ensureRuntime()
      .then(function () {
        const containers = document.querySelectorAll("[data-three-nocode-scene]");
        containers.forEach(function (container) {
          if (container.dataset.viewerMounted === "true") {
            return;
          }
          container.dataset.viewerMounted = "true";
          initContainer(container);
        });
      })
      .catch(function (error) {
        console.error("[ThreeNoCodeViewer]", error);
      });
  }

  window.ThreeNoCodeViewer = {
    init: init,
    version: THREE_VERSION
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
