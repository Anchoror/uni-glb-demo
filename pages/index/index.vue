<template>
	<view class="content">
		<canvas type="webgl" id="webgl" style="width: 100vw; height: 100vh" @touchstart="touchStart" @touchmove="touchMove" @touchend="touchEnd"></canvas>
	</view>
</template>

<script setup>
	import { createScopedThreejs  } from 'threejs-miniprogram'
	import { onReady } from '@dcloudio/uni-app';
	import { registerGLTFLoader } from '../../utils/gltf-loader.js';
	import { registerTextureLoader } from '../../utils/texture_loader.js';
	import registerOrbit from '../../utils/orbit.js';
	
	let THREE = null;
	let canvas = null;
	let renderer = null
	let scene = null;
	let camera = null;
	let controls = null
	
	onReady(() => {
		init();
	});
	async function init() {
		await createThree();
		createRenderer()
		createScene();
		createCamera();
		createLight();
		registerTextureLoader(THREE);//替换textureloader
		registerGLTFLoader(THREE); //添加gltf加载器
		//glb纹理需要blob,小程序没有
		const res = await loadGLTF('http://127.0.0.1:8080/upload/sci-fi_building_8.glb');
		scene.add(res);
		
		
		renderer.render(scene, camera);
		createControls();
		animate();
	}
	function createThree() {
		return new Promise((resolve) => {
			uni.createSelectorQuery()
				.select('#webgl')
				.node()
				.exec((res) => {
					//canvas做动画时要用
					canvas = res[0].node;
					// 创建一个与 canvas 绑定的 three.js
					THREE = createScopedThreejs(canvas);
					THREE.canvas=canvas;
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
		camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
		camera.position.set(400, 400, 800);
		camera.lookAt(0, 0, 0);
	}
	function loadGLTF(url) {
		return new Promise((resolve, reject) => {
			new THREE.GLTFLoader().load(url, (gltf) => {
				console.log('gltf',gltf)
				// gltf.scene.scale.set(1, 1, 1);
				resolve(gltf.scene);
			});
		});
	}
	function createLight() {
		const light = new THREE.AmbientLight(0xffffff,2);
		scene.add(light);
	}
	function createControls() {
		const orbits = registerOrbit(THREE);
		// console.log(orbits)
		controls = new orbits.OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
	}
	function animate() {
		//小程序没有window.requestAnimationFrame
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
</script>

<style>
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
</style>
