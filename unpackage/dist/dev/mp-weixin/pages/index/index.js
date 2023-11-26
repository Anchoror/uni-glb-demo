"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_gltfLoader = require("../../utils/gltf-loader.js");
const utils_texture_loader = require("../../utils/texture_loader.js");
const utils_orbit = require("../../utils/orbit.js");
const _sfc_main = {
  __name: "index",
  setup(__props) {
    let THREE = null;
    let canvas = null;
    let renderer = null;
    let scene = null;
    let camera = null;
    let controls = null;
    common_vendor.onReady(() => {
      init();
    });
    async function init() {
      await createThree();
      createRenderer();
      createScene();
      createCamera();
      createLight();
      utils_texture_loader.registerTextureLoader(THREE);
      utils_gltfLoader.registerGLTFLoader(THREE);
      const res = await loadGLTF("http://127.0.0.1:8080/upload/sci-fi_building_8.glb");
      scene.add(res);
      renderer.render(scene, camera);
      createControls();
      animate();
    }
    function createThree() {
      return new Promise((resolve) => {
        common_vendor.index.createSelectorQuery().select("#webgl").node().exec((res) => {
          canvas = res[0].node;
          THREE = common_vendor.dist.createScopedThreejs(canvas);
          THREE.canvas = canvas;
          resolve();
        });
      });
    }
    function createRenderer() {
      renderer = new THREE.WebGLRenderer();
      renderer.setSize(canvas.width, canvas.height);
    }
    function createScene() {
      scene = new THREE.Scene();
    }
    function createCamera() {
      camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1e3);
      camera.position.set(400, 400, 800);
      camera.lookAt(0, 0, 0);
    }
    function loadGLTF(url) {
      return new Promise((resolve, reject) => {
        new THREE.GLTFLoader().load(url, (gltf) => {
          console.log("gltf", gltf);
          resolve(gltf.scene);
        });
      });
    }
    function createLight() {
      const light = new THREE.AmbientLight(16777215, 2);
      scene.add(light);
    }
    function createControls() {
      const orbits = utils_orbit.registerOrbit(THREE);
      controls = new orbits.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
    }
    function animate() {
      canvas.requestAnimationFrame(animate);
      renderer.render(scene, camera);
      controls.update();
    }
    function touchMove(e) {
      controls.onTouchMove(e);
    }
    function touchEnd(e) {
      controls.onTouchEnd(e);
    }
    function touchStart(e) {
      controls.onTouchStart(e);
    }
    return (_ctx, _cache) => {
      return {
        a: common_vendor.o(touchStart),
        b: common_vendor.o(touchMove),
        c: common_vendor.o(touchEnd)
      };
    };
  }
};
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__file", "D:/own-project/myApp/pages/index/index.vue"]]);
wx.createPage(MiniProgramPage);
