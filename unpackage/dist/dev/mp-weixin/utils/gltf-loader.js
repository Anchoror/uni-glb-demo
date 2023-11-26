"use strict";
function registerGLTFLoader(THREE) {
  console.log("注册新的GLTF加载器");
  THREE.GLTFLoader = function() {
    function GLTFLoader(manager) {
      this.manager = manager !== void 0 ? manager : THREE.DefaultLoadingManager;
      this.dracoLoader = null;
      this.ddsLoader = null;
    }
    GLTFLoader.prototype = {
      constructor: GLTFLoader,
      crossOrigin: "anonymous",
      load: function(url, onLoad, onProgress, onError) {
        var scope = this;
        var resourcePath;
        if (this.resourcePath !== void 0) {
          resourcePath = this.resourcePath;
        } else if (this.path !== void 0) {
          resourcePath = this.path;
        } else {
          console.log(url);
          resourcePath = THREE.LoaderUtils.extractUrlBase(url);
        }
        scope.manager.itemStart(url);
        var _onError = function(e) {
          if (onError) {
            onError(e);
          } else {
            console.error(e);
          }
          scope.manager.itemError(url);
          scope.manager.itemEnd(url);
        };
        var loader = new THREE.FileLoader(scope.manager);
        loader.setPath(this.path);
        loader.setResponseType("arraybuffer");
        if (scope.crossOrigin === "use-credentials") {
          loader.setWithCredentials(true);
        }
        loader.load(url, function(data) {
          try {
            scope.parse(data, resourcePath, function(gltf) {
              onLoad(gltf);
              scope.manager.itemEnd(url);
            }, _onError);
          } catch (e) {
            _onError(e);
          }
        }, onProgress, _onError);
      },
      setCrossOrigin: function(value) {
        this.crossOrigin = value;
        return this;
      },
      setPath: function(value) {
        this.path = value;
        return this;
      },
      setResourcePath: function(value) {
        this.resourcePath = value;
        return this;
      },
      setDRACOLoader: function(dracoLoader) {
        this.dracoLoader = dracoLoader;
        return this;
      },
      setDDSLoader: function(ddsLoader) {
        this.ddsLoader = ddsLoader;
        return this;
      },
      parse: function(data, path, onLoad, onError) {
        var content;
        var extensions = {};
        if (typeof data === "string") {
          content = data;
        } else {
          var magic = THREE.LoaderUtils.decodeText(new Uint8Array(data, 0, 4));
          if (magic === BINARY_EXTENSION_HEADER_MAGIC) {
            try {
              extensions[EXTENSIONS.KHR_BINARY_GLTF] = new GLTFBinaryExtension(data);
            } catch (error) {
              if (onError)
                onError(error);
              return;
            }
            content = extensions[EXTENSIONS.KHR_BINARY_GLTF].content;
          } else {
            content = THREE.LoaderUtils.decodeText(new Uint8Array(data));
          }
        }
        var json = JSON.parse(content);
        if (json.asset === void 0 || json.asset.version[0] < 2) {
          if (onError)
            onError(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported. Use LegacyGLTFLoader instead."));
          return;
        }
        if (json.extensionsUsed) {
          for (var i = 0; i < json.extensionsUsed.length; ++i) {
            var extensionName = json.extensionsUsed[i];
            var extensionsRequired = json.extensionsRequired || [];
            switch (extensionName) {
              case EXTENSIONS.KHR_LIGHTS_PUNCTUAL:
                extensions[extensionName] = new GLTFLightsExtension(json);
                break;
              case EXTENSIONS.KHR_MATERIALS_UNLIT:
                extensions[extensionName] = new GLTFMaterialsUnlitExtension();
                break;
              case EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS:
                extensions[extensionName] = new GLTFMaterialsPbrSpecularGlossinessExtension();
                break;
              case EXTENSIONS.KHR_DRACO_MESH_COMPRESSION:
                extensions[extensionName] = new GLTFDracoMeshCompressionExtension(json, this.dracoLoader);
                break;
              case EXTENSIONS.MSFT_TEXTURE_DDS:
                extensions[EXTENSIONS.MSFT_TEXTURE_DDS] = new GLTFTextureDDSExtension(this.ddsLoader);
                break;
              case EXTENSIONS.KHR_TEXTURE_TRANSFORM:
                extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM] = new GLTFTextureTransformExtension();
                break;
              default:
                if (extensionsRequired.indexOf(extensionName) >= 0) {
                  console.warn('THREE.GLTFLoader: Unknown extension "' + extensionName + '".');
                }
            }
          }
        }
        var parser = new GLTFParser(json, extensions, {
          path: path || this.resourcePath || "",
          crossOrigin: this.crossOrigin,
          manager: this.manager
        });
        parser.parse(onLoad, onError);
      }
    };
    function GLTFRegistry() {
      var objects = {};
      return {
        get: function(key) {
          return objects[key];
        },
        add: function(key, object) {
          objects[key] = object;
        },
        remove: function(key) {
          delete objects[key];
        },
        removeAll: function() {
          objects = {};
        }
      };
    }
    var EXTENSIONS = {
      KHR_BINARY_GLTF: "KHR_binary_glTF",
      KHR_DRACO_MESH_COMPRESSION: "KHR_draco_mesh_compression",
      KHR_LIGHTS_PUNCTUAL: "KHR_lights_punctual",
      KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS: "KHR_materials_pbrSpecularGlossiness",
      KHR_MATERIALS_UNLIT: "KHR_materials_unlit",
      KHR_TEXTURE_TRANSFORM: "KHR_texture_transform",
      MSFT_TEXTURE_DDS: "MSFT_texture_dds"
    };
    function GLTFTextureDDSExtension(ddsLoader) {
      if (!ddsLoader) {
        throw new Error("THREE.GLTFLoader: Attempting to load .dds texture without importing THREE.DDSLoader");
      }
      this.name = EXTENSIONS.MSFT_TEXTURE_DDS;
      this.ddsLoader = ddsLoader;
    }
    function GLTFLightsExtension(json) {
      this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL;
      var extension = json.extensions && json.extensions[EXTENSIONS.KHR_LIGHTS_PUNCTUAL] || {};
      this.lightDefs = extension.lights || [];
    }
    GLTFLightsExtension.prototype.loadLight = function(lightIndex) {
      var lightDef = this.lightDefs[lightIndex];
      var lightNode;
      var color = new THREE.Color(16777215);
      if (lightDef.color !== void 0)
        color.fromArray(lightDef.color);
      var range = lightDef.range !== void 0 ? lightDef.range : 0;
      switch (lightDef.type) {
        case "directional":
          lightNode = new THREE.DirectionalLight(color);
          lightNode.target.position.set(0, 0, -1);
          lightNode.add(lightNode.target);
          break;
        case "point":
          lightNode = new THREE.PointLight(color);
          lightNode.distance = range;
          break;
        case "spot":
          lightNode = new THREE.SpotLight(color);
          lightNode.distance = range;
          lightDef.spot = lightDef.spot || {};
          lightDef.spot.innerConeAngle = lightDef.spot.innerConeAngle !== void 0 ? lightDef.spot.innerConeAngle : 0;
          lightDef.spot.outerConeAngle = lightDef.spot.outerConeAngle !== void 0 ? lightDef.spot.outerConeAngle : Math.PI / 4;
          lightNode.angle = lightDef.spot.outerConeAngle;
          lightNode.penumbra = 1 - lightDef.spot.innerConeAngle / lightDef.spot.outerConeAngle;
          lightNode.target.position.set(0, 0, -1);
          lightNode.add(lightNode.target);
          break;
        default:
          throw new Error('THREE.GLTFLoader: Unexpected light type, "' + lightDef.type + '".');
      }
      lightNode.position.set(0, 0, 0);
      lightNode.decay = 2;
      if (lightDef.intensity !== void 0)
        lightNode.intensity = lightDef.intensity;
      lightNode.name = lightDef.name || "light_" + lightIndex;
      return Promise.resolve(lightNode);
    };
    function GLTFMaterialsUnlitExtension() {
      this.name = EXTENSIONS.KHR_MATERIALS_UNLIT;
    }
    GLTFMaterialsUnlitExtension.prototype.getMaterialType = function() {
      return THREE.MeshBasicMaterial;
    };
    GLTFMaterialsUnlitExtension.prototype.extendParams = function(materialParams, materialDef, parser) {
      var pending = [];
      materialParams.color = new THREE.Color(1, 1, 1);
      materialParams.opacity = 1;
      var metallicRoughness = materialDef.pbrMetallicRoughness;
      if (metallicRoughness) {
        if (Array.isArray(metallicRoughness.baseColorFactor)) {
          var array = metallicRoughness.baseColorFactor;
          materialParams.color.fromArray(array);
          materialParams.opacity = array[3];
        }
        if (metallicRoughness.baseColorTexture !== void 0) {
          pending.push(parser.assignTexture(materialParams, "map", metallicRoughness.baseColorTexture));
        }
      }
      return Promise.all(pending);
    };
    var BINARY_EXTENSION_HEADER_MAGIC = "glTF";
    var BINARY_EXTENSION_HEADER_LENGTH = 12;
    var BINARY_EXTENSION_CHUNK_TYPES = { JSON: 1313821514, BIN: 5130562 };
    function GLTFBinaryExtension(data) {
      this.name = EXTENSIONS.KHR_BINARY_GLTF;
      this.content = null;
      this.body = null;
      var headerView = new DataView(data, 0, BINARY_EXTENSION_HEADER_LENGTH);
      this.header = {
        magic: THREE.LoaderUtils.decodeText(new Uint8Array(data.slice(0, 4))),
        version: headerView.getUint32(4, true),
        length: headerView.getUint32(8, true)
      };
      if (this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC) {
        throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");
      } else if (this.header.version < 2) {
        throw new Error("THREE.GLTFLoader: Legacy binary file detected. Use LegacyGLTFLoader instead.");
      }
      var chunkView = new DataView(data, BINARY_EXTENSION_HEADER_LENGTH);
      var chunkIndex = 0;
      while (chunkIndex < chunkView.byteLength) {
        var chunkLength = chunkView.getUint32(chunkIndex, true);
        chunkIndex += 4;
        var chunkType = chunkView.getUint32(chunkIndex, true);
        chunkIndex += 4;
        if (chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON) {
          var contentArray = new Uint8Array(data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength);
          this.content = THREE.LoaderUtils.decodeText(contentArray);
        } else if (chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN) {
          var byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
          this.body = data.slice(byteOffset, byteOffset + chunkLength);
        }
        chunkIndex += chunkLength;
      }
      if (this.content === null) {
        throw new Error("THREE.GLTFLoader: JSON content not found.");
      }
    }
    function GLTFDracoMeshCompressionExtension(json, dracoLoader) {
      if (!dracoLoader) {
        throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");
      }
      this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;
      this.json = json;
      this.dracoLoader = dracoLoader;
    }
    GLTFDracoMeshCompressionExtension.prototype.decodePrimitive = function(primitive, parser) {
      var json = this.json;
      var dracoLoader = this.dracoLoader;
      var bufferViewIndex = primitive.extensions[this.name].bufferView;
      var gltfAttributeMap = primitive.extensions[this.name].attributes;
      var threeAttributeMap = {};
      var attributeNormalizedMap = {};
      var attributeTypeMap = {};
      for (var attributeName in gltfAttributeMap) {
        var threeAttributeName = ATTRIBUTES[attributeName] || attributeName.toLowerCase();
        threeAttributeMap[threeAttributeName] = gltfAttributeMap[attributeName];
      }
      for (attributeName in primitive.attributes) {
        var threeAttributeName = ATTRIBUTES[attributeName] || attributeName.toLowerCase();
        if (gltfAttributeMap[attributeName] !== void 0) {
          var accessorDef = json.accessors[primitive.attributes[attributeName]];
          var componentType = WEBGL_COMPONENT_TYPES[accessorDef.componentType];
          attributeTypeMap[threeAttributeName] = componentType;
          attributeNormalizedMap[threeAttributeName] = accessorDef.normalized === true;
        }
      }
      return parser.getDependency("bufferView", bufferViewIndex).then(function(bufferView) {
        return new Promise(function(resolve) {
          dracoLoader.decodeDracoFile(bufferView, function(geometry) {
            for (var attributeName2 in geometry.attributes) {
              var attribute = geometry.attributes[attributeName2];
              var normalized = attributeNormalizedMap[attributeName2];
              if (normalized !== void 0)
                attribute.normalized = normalized;
            }
            resolve(geometry);
          }, threeAttributeMap, attributeTypeMap);
        });
      });
    };
    function GLTFTextureTransformExtension() {
      this.name = EXTENSIONS.KHR_TEXTURE_TRANSFORM;
    }
    GLTFTextureTransformExtension.prototype.extendTexture = function(texture, transform) {
      texture = texture.clone();
      if (transform.offset !== void 0) {
        texture.offset.fromArray(transform.offset);
      }
      if (transform.rotation !== void 0) {
        texture.rotation = transform.rotation;
      }
      if (transform.scale !== void 0) {
        texture.repeat.fromArray(transform.scale);
      }
      if (transform.texCoord !== void 0) {
        console.warn('THREE.GLTFLoader: Custom UV sets in "' + this.name + '" extension not yet supported.');
      }
      texture.needsUpdate = true;
      return texture;
    };
    function GLTFMaterialsPbrSpecularGlossinessExtension() {
      return {
        name: EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS,
        specularGlossinessParams: [
          "color",
          "map",
          "lightMap",
          "lightMapIntensity",
          "aoMap",
          "aoMapIntensity",
          "emissive",
          "emissiveIntensity",
          "emissiveMap",
          "bumpMap",
          "bumpScale",
          "normalMap",
          "displacementMap",
          "displacementScale",
          "displacementBias",
          "specularMap",
          "specular",
          "glossinessMap",
          "glossiness",
          "alphaMap",
          "envMap",
          "envMapIntensity",
          "refractionRatio"
        ],
        getMaterialType: function() {
          return THREE.ShaderMaterial;
        },
        extendParams: function(materialParams, materialDef, parser) {
          var pbrSpecularGlossiness = materialDef.extensions[this.name];
          var shader = THREE.ShaderLib["standard"];
          var uniforms = THREE.UniformsUtils.clone(shader.uniforms);
          var specularMapParsFragmentChunk = [
            "#ifdef USE_SPECULARMAP",
            "	uniform sampler2D specularMap;",
            "#endif"
          ].join("\n");
          var glossinessMapParsFragmentChunk = [
            "#ifdef USE_GLOSSINESSMAP",
            "	uniform sampler2D glossinessMap;",
            "#endif"
          ].join("\n");
          var specularMapFragmentChunk = [
            "vec3 specularFactor = specular;",
            "#ifdef USE_SPECULARMAP",
            "	vec4 texelSpecular = texture2D( specularMap, vUv );",
            "	texelSpecular = sRGBToLinear( texelSpecular );",
            "	// reads channel RGB, compatible with a glTF Specular-Glossiness (RGBA) texture",
            "	specularFactor *= texelSpecular.rgb;",
            "#endif"
          ].join("\n");
          var glossinessMapFragmentChunk = [
            "float glossinessFactor = glossiness;",
            "#ifdef USE_GLOSSINESSMAP",
            "	vec4 texelGlossiness = texture2D( glossinessMap, vUv );",
            "	// reads channel A, compatible with a glTF Specular-Glossiness (RGBA) texture",
            "	glossinessFactor *= texelGlossiness.a;",
            "#endif"
          ].join("\n");
          var lightPhysicalFragmentChunk = [
            "PhysicalMaterial material;",
            "material.diffuseColor = diffuseColor.rgb;",
            "material.specularRoughness = clamp( 1.0 - glossinessFactor, 0.04, 1.0 );",
            "material.specularColor = specularFactor.rgb;"
          ].join("\n");
          var fragmentShader = shader.fragmentShader.replace("uniform float roughness;", "uniform vec3 specular;").replace("uniform float metalness;", "uniform float glossiness;").replace("#include <roughnessmap_pars_fragment>", specularMapParsFragmentChunk).replace("#include <metalnessmap_pars_fragment>", glossinessMapParsFragmentChunk).replace("#include <roughnessmap_fragment>", specularMapFragmentChunk).replace("#include <metalnessmap_fragment>", glossinessMapFragmentChunk).replace("#include <lights_physical_fragment>", lightPhysicalFragmentChunk);
          delete uniforms.roughness;
          delete uniforms.metalness;
          delete uniforms.roughnessMap;
          delete uniforms.metalnessMap;
          uniforms.specular = { value: new THREE.Color().setHex(1118481) };
          uniforms.glossiness = { value: 0.5 };
          uniforms.specularMap = { value: null };
          uniforms.glossinessMap = { value: null };
          materialParams.vertexShader = shader.vertexShader;
          materialParams.fragmentShader = fragmentShader;
          materialParams.uniforms = uniforms;
          materialParams.defines = { "STANDARD": "" };
          materialParams.color = new THREE.Color(1, 1, 1);
          materialParams.opacity = 1;
          var pending = [];
          if (Array.isArray(pbrSpecularGlossiness.diffuseFactor)) {
            var array = pbrSpecularGlossiness.diffuseFactor;
            materialParams.color.fromArray(array);
            materialParams.opacity = array[3];
          }
          if (pbrSpecularGlossiness.diffuseTexture !== void 0) {
            pending.push(parser.assignTexture(materialParams, "map", pbrSpecularGlossiness.diffuseTexture));
          }
          materialParams.emissive = new THREE.Color(0, 0, 0);
          materialParams.glossiness = pbrSpecularGlossiness.glossinessFactor !== void 0 ? pbrSpecularGlossiness.glossinessFactor : 1;
          materialParams.specular = new THREE.Color(1, 1, 1);
          if (Array.isArray(pbrSpecularGlossiness.specularFactor)) {
            materialParams.specular.fromArray(pbrSpecularGlossiness.specularFactor);
          }
          if (pbrSpecularGlossiness.specularGlossinessTexture !== void 0) {
            var specGlossMapDef = pbrSpecularGlossiness.specularGlossinessTexture;
            pending.push(parser.assignTexture(materialParams, "glossinessMap", specGlossMapDef));
            pending.push(parser.assignTexture(materialParams, "specularMap", specGlossMapDef));
          }
          return Promise.all(pending);
        },
        createMaterial: function(params) {
          var material = new THREE.ShaderMaterial({
            defines: params.defines,
            vertexShader: params.vertexShader,
            fragmentShader: params.fragmentShader,
            uniforms: params.uniforms,
            fog: true,
            lights: true,
            opacity: params.opacity,
            transparent: params.transparent
          });
          material.isGLTFSpecularGlossinessMaterial = true;
          material.color = params.color;
          material.map = params.map === void 0 ? null : params.map;
          material.lightMap = null;
          material.lightMapIntensity = 1;
          material.aoMap = params.aoMap === void 0 ? null : params.aoMap;
          material.aoMapIntensity = 1;
          material.emissive = params.emissive;
          material.emissiveIntensity = 1;
          material.emissiveMap = params.emissiveMap === void 0 ? null : params.emissiveMap;
          material.bumpMap = params.bumpMap === void 0 ? null : params.bumpMap;
          material.bumpScale = 1;
          material.normalMap = params.normalMap === void 0 ? null : params.normalMap;
          if (params.normalScale)
            material.normalScale = params.normalScale;
          material.displacementMap = null;
          material.displacementScale = 1;
          material.displacementBias = 0;
          material.specularMap = params.specularMap === void 0 ? null : params.specularMap;
          material.specular = params.specular;
          material.glossinessMap = params.glossinessMap === void 0 ? null : params.glossinessMap;
          material.glossiness = params.glossiness;
          material.alphaMap = null;
          material.envMap = params.envMap === void 0 ? null : params.envMap;
          material.envMapIntensity = 1;
          material.refractionRatio = 0.98;
          material.extensions.derivatives = true;
          return material;
        },
        /**
         * Clones a GLTFSpecularGlossinessMaterial instance. The ShaderMaterial.copy() method can
         * copy only properties it knows about or inherits, and misses many properties that would
         * normally be defined by MeshStandardMaterial.
         *
         * This method allows GLTFSpecularGlossinessMaterials to be cloned in the process of
         * loading a glTF model, but cloning later (e.g. by the user) would require these changes
         * AND also updating `.onBeforeRender` on the parent mesh.
         *
         * @param  {THREE.ShaderMaterial} source
         * @return {THREE.ShaderMaterial}
         */
        cloneMaterial: function(source) {
          var target = source.clone();
          target.isGLTFSpecularGlossinessMaterial = true;
          var params = this.specularGlossinessParams;
          for (var i = 0, il = params.length; i < il; i++) {
            var value = source[params[i]];
            target[params[i]] = value && value.isColor ? value.clone() : value;
          }
          return target;
        },
        // Here's based on refreshUniformsCommon() and refreshUniformsStandard() in WebGLRenderer.
        refreshUniforms: function(renderer, scene, camera, geometry, material) {
          if (material.isGLTFSpecularGlossinessMaterial !== true) {
            return;
          }
          var uniforms = material.uniforms;
          var defines = material.defines;
          uniforms.opacity.value = material.opacity;
          uniforms.diffuse.value.copy(material.color);
          uniforms.emissive.value.copy(material.emissive).multiplyScalar(material.emissiveIntensity);
          uniforms.map.value = material.map;
          uniforms.specularMap.value = material.specularMap;
          uniforms.alphaMap.value = material.alphaMap;
          uniforms.lightMap.value = material.lightMap;
          uniforms.lightMapIntensity.value = material.lightMapIntensity;
          uniforms.aoMap.value = material.aoMap;
          uniforms.aoMapIntensity.value = material.aoMapIntensity;
          var uvScaleMap;
          if (material.map) {
            uvScaleMap = material.map;
          } else if (material.specularMap) {
            uvScaleMap = material.specularMap;
          } else if (material.displacementMap) {
            uvScaleMap = material.displacementMap;
          } else if (material.normalMap) {
            uvScaleMap = material.normalMap;
          } else if (material.bumpMap) {
            uvScaleMap = material.bumpMap;
          } else if (material.glossinessMap) {
            uvScaleMap = material.glossinessMap;
          } else if (material.alphaMap) {
            uvScaleMap = material.alphaMap;
          } else if (material.emissiveMap) {
            uvScaleMap = material.emissiveMap;
          }
          if (uvScaleMap !== void 0) {
            if (uvScaleMap.isWebGLRenderTarget) {
              uvScaleMap = uvScaleMap.texture;
            }
            if (uvScaleMap.matrixAutoUpdate === true) {
              uvScaleMap.updateMatrix();
            }
            uniforms.uvTransform.value.copy(uvScaleMap.matrix);
          }
          if (material.envMap) {
            uniforms.envMap.value = material.envMap;
            uniforms.envMapIntensity.value = material.envMapIntensity;
            uniforms.flipEnvMap.value = material.envMap.isCubeTexture ? -1 : 1;
            uniforms.reflectivity.value = material.reflectivity;
            uniforms.refractionRatio.value = material.refractionRatio;
            uniforms.maxMipLevel.value = renderer.properties.get(material.envMap).__maxMipLevel;
          }
          uniforms.specular.value.copy(material.specular);
          uniforms.glossiness.value = material.glossiness;
          uniforms.glossinessMap.value = material.glossinessMap;
          uniforms.emissiveMap.value = material.emissiveMap;
          uniforms.bumpMap.value = material.bumpMap;
          uniforms.normalMap.value = material.normalMap;
          uniforms.displacementMap.value = material.displacementMap;
          uniforms.displacementScale.value = material.displacementScale;
          uniforms.displacementBias.value = material.displacementBias;
          if (uniforms.glossinessMap.value !== null && defines.USE_GLOSSINESSMAP === void 0) {
            defines.USE_GLOSSINESSMAP = "";
            defines.USE_ROUGHNESSMAP = "";
          }
          if (uniforms.glossinessMap.value === null && defines.USE_GLOSSINESSMAP !== void 0) {
            delete defines.USE_GLOSSINESSMAP;
            delete defines.USE_ROUGHNESSMAP;
          }
        }
      };
    }
    function GLTFCubicSplineInterpolant(parameterPositions, sampleValues, sampleSize, resultBuffer) {
      THREE.Interpolant.call(this, parameterPositions, sampleValues, sampleSize, resultBuffer);
    }
    GLTFCubicSplineInterpolant.prototype = Object.create(THREE.Interpolant.prototype);
    GLTFCubicSplineInterpolant.prototype.constructor = GLTFCubicSplineInterpolant;
    GLTFCubicSplineInterpolant.prototype.copySampleValue_ = function(index) {
      var result = this.resultBuffer, values = this.sampleValues, valueSize = this.valueSize, offset = index * valueSize * 3 + valueSize;
      for (var i = 0; i !== valueSize; i++) {
        result[i] = values[offset + i];
      }
      return result;
    };
    GLTFCubicSplineInterpolant.prototype.beforeStart_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;
    GLTFCubicSplineInterpolant.prototype.afterEnd_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;
    GLTFCubicSplineInterpolant.prototype.interpolate_ = function(i1, t0, t, t1) {
      var result = this.resultBuffer;
      var values = this.sampleValues;
      var stride = this.valueSize;
      var stride2 = stride * 2;
      var stride3 = stride * 3;
      var td = t1 - t0;
      var p = (t - t0) / td;
      var pp = p * p;
      var ppp = pp * p;
      var offset1 = i1 * stride3;
      var offset0 = offset1 - stride3;
      var s2 = -2 * ppp + 3 * pp;
      var s3 = ppp - pp;
      var s0 = 1 - s2;
      var s1 = s3 - pp + p;
      for (var i = 0; i !== stride; i++) {
        var p0 = values[offset0 + i + stride];
        var m0 = values[offset0 + i + stride2] * td;
        var p1 = values[offset1 + i + stride];
        var m1 = values[offset1 + i] * td;
        result[i] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1;
      }
      return result;
    };
    var WEBGL_CONSTANTS = {
      FLOAT: 5126,
      //FLOAT_MAT2: 35674,
      FLOAT_MAT3: 35675,
      FLOAT_MAT4: 35676,
      FLOAT_VEC2: 35664,
      FLOAT_VEC3: 35665,
      FLOAT_VEC4: 35666,
      LINEAR: 9729,
      REPEAT: 10497,
      SAMPLER_2D: 35678,
      POINTS: 0,
      LINES: 1,
      LINE_LOOP: 2,
      LINE_STRIP: 3,
      TRIANGLES: 4,
      TRIANGLE_STRIP: 5,
      TRIANGLE_FAN: 6,
      UNSIGNED_BYTE: 5121,
      UNSIGNED_SHORT: 5123
    };
    var WEBGL_COMPONENT_TYPES = {
      5120: Int8Array,
      5121: Uint8Array,
      5122: Int16Array,
      5123: Uint16Array,
      5125: Uint32Array,
      5126: Float32Array
    };
    var WEBGL_FILTERS = {
      9728: THREE.NearestFilter,
      9729: THREE.LinearFilter,
      9984: THREE.NearestMipmapNearestFilter,
      9985: THREE.LinearMipmapNearestFilter,
      9986: THREE.NearestMipmapLinearFilter,
      9987: THREE.LinearMipmapLinearFilter
    };
    var WEBGL_WRAPPINGS = {
      33071: THREE.ClampToEdgeWrapping,
      33648: THREE.MirroredRepeatWrapping,
      10497: THREE.RepeatWrapping
    };
    var WEBGL_TYPE_SIZES = {
      "SCALAR": 1,
      "VEC2": 2,
      "VEC3": 3,
      "VEC4": 4,
      "MAT2": 4,
      "MAT3": 9,
      "MAT4": 16
    };
    var ATTRIBUTES = {
      POSITION: "position",
      NORMAL: "normal",
      TANGENT: "tangent",
      TEXCOORD_0: "uv",
      TEXCOORD_1: "uv2",
      COLOR_0: "color",
      WEIGHTS_0: "skinWeight",
      JOINTS_0: "skinIndex"
    };
    var PATH_PROPERTIES = {
      scale: "scale",
      translation: "position",
      rotation: "quaternion",
      weights: "morphTargetInfluences"
    };
    var INTERPOLATION = {
      CUBICSPLINE: void 0,
      // We use a custom interpolant (GLTFCubicSplineInterpolation) for CUBICSPLINE tracks. Each
      // keyframe track will be initialized with a default interpolation type, then modified.
      LINEAR: THREE.InterpolateLinear,
      STEP: THREE.InterpolateDiscrete
    };
    var ALPHA_MODES = {
      OPAQUE: "OPAQUE",
      MASK: "MASK",
      BLEND: "BLEND"
    };
    var MIME_TYPE_FORMATS = {
      "image/png": THREE.RGBAFormat,
      "image/jpeg": THREE.RGBFormat
    };
    function resolveURL(url, path) {
      if (typeof url !== "string" || url === "")
        return "";
      if (/^https?:\/\//i.test(path) && /^\//.test(url)) {
        path = path.replace(/(^https?:\/\/[^\/]+).*/i, "$1");
      }
      if (/^(https?:)?\/\//i.test(url))
        return url;
      if (/^data:.*,.*$/i.test(url))
        return url;
      if (/^blob:.*$/i.test(url))
        return url;
      return path + url;
    }
    var defaultMaterial;
    function createDefaultMaterial() {
      defaultMaterial = defaultMaterial || new THREE.MeshStandardMaterial({
        color: 16777215,
        emissive: 0,
        metalness: 1,
        roughness: 1,
        transparent: false,
        depthTest: true,
        side: THREE.FrontSide
      });
      return defaultMaterial;
    }
    function addUnknownExtensionsToUserData(knownExtensions, object, objectDef) {
      for (var name in objectDef.extensions) {
        if (knownExtensions[name] === void 0) {
          object.userData.gltfExtensions = object.userData.gltfExtensions || {};
          object.userData.gltfExtensions[name] = objectDef.extensions[name];
        }
      }
    }
    function assignExtrasToUserData(object, gltfDef) {
      if (gltfDef.extras !== void 0) {
        if (typeof gltfDef.extras === "object") {
          Object.assign(object.userData, gltfDef.extras);
        } else {
          console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, " + gltfDef.extras);
        }
      }
    }
    function addMorphTargets(geometry, targets, parser) {
      var hasMorphPosition = false;
      var hasMorphNormal = false;
      for (var i = 0, il = targets.length; i < il; i++) {
        var target = targets[i];
        if (target.POSITION !== void 0)
          hasMorphPosition = true;
        if (target.NORMAL !== void 0)
          hasMorphNormal = true;
        if (hasMorphPosition && hasMorphNormal)
          break;
      }
      if (!hasMorphPosition && !hasMorphNormal)
        return Promise.resolve(geometry);
      var pendingPositionAccessors = [];
      var pendingNormalAccessors = [];
      for (var i = 0, il = targets.length; i < il; i++) {
        var target = targets[i];
        if (hasMorphPosition) {
          var pendingAccessor = target.POSITION !== void 0 ? parser.getDependency("accessor", target.POSITION) : geometry.attributes.position;
          pendingPositionAccessors.push(pendingAccessor);
        }
        if (hasMorphNormal) {
          var pendingAccessor = target.NORMAL !== void 0 ? parser.getDependency("accessor", target.NORMAL) : geometry.attributes.normal;
          pendingNormalAccessors.push(pendingAccessor);
        }
      }
      return Promise.all([
        Promise.all(pendingPositionAccessors),
        Promise.all(pendingNormalAccessors)
      ]).then(function(accessors) {
        var morphPositions = accessors[0];
        var morphNormals = accessors[1];
        for (var i2 = 0, il2 = morphPositions.length; i2 < il2; i2++) {
          if (geometry.attributes.position === morphPositions[i2])
            continue;
          morphPositions[i2] = cloneBufferAttribute(morphPositions[i2]);
        }
        for (var i2 = 0, il2 = morphNormals.length; i2 < il2; i2++) {
          if (geometry.attributes.normal === morphNormals[i2])
            continue;
          morphNormals[i2] = cloneBufferAttribute(morphNormals[i2]);
        }
        for (var i2 = 0, il2 = targets.length; i2 < il2; i2++) {
          var target2 = targets[i2];
          var attributeName = "morphTarget" + i2;
          if (hasMorphPosition) {
            if (target2.POSITION !== void 0) {
              var positionAttribute = morphPositions[i2];
              positionAttribute.name = attributeName;
              var position = geometry.attributes.position;
              for (var j = 0, jl = positionAttribute.count; j < jl; j++) {
                positionAttribute.setXYZ(
                  j,
                  positionAttribute.getX(j) + position.getX(j),
                  positionAttribute.getY(j) + position.getY(j),
                  positionAttribute.getZ(j) + position.getZ(j)
                );
              }
            }
          }
          if (hasMorphNormal) {
            if (target2.NORMAL !== void 0) {
              var normalAttribute = morphNormals[i2];
              normalAttribute.name = attributeName;
              var normal = geometry.attributes.normal;
              for (var j = 0, jl = normalAttribute.count; j < jl; j++) {
                normalAttribute.setXYZ(
                  j,
                  normalAttribute.getX(j) + normal.getX(j),
                  normalAttribute.getY(j) + normal.getY(j),
                  normalAttribute.getZ(j) + normal.getZ(j)
                );
              }
            }
          }
        }
        if (hasMorphPosition)
          geometry.morphAttributes.position = morphPositions;
        if (hasMorphNormal)
          geometry.morphAttributes.normal = morphNormals;
        return geometry;
      });
    }
    function updateMorphTargets(mesh, meshDef) {
      mesh.updateMorphTargets();
      if (meshDef.weights !== void 0) {
        for (var i = 0, il = meshDef.weights.length; i < il; i++) {
          mesh.morphTargetInfluences[i] = meshDef.weights[i];
        }
      }
      if (meshDef.extras && Array.isArray(meshDef.extras.targetNames)) {
        var targetNames = meshDef.extras.targetNames;
        if (mesh.morphTargetInfluences.length === targetNames.length) {
          mesh.morphTargetDictionary = {};
          for (var i = 0, il = targetNames.length; i < il; i++) {
            mesh.morphTargetDictionary[targetNames[i]] = i;
          }
        } else {
          console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.");
        }
      }
    }
    function createPrimitiveKey(primitiveDef) {
      var dracoExtension = primitiveDef.extensions && primitiveDef.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION];
      var geometryKey;
      if (dracoExtension) {
        geometryKey = "draco:" + dracoExtension.bufferView + ":" + dracoExtension.indices + ":" + createAttributesKey(dracoExtension.attributes);
      } else {
        geometryKey = primitiveDef.indices + ":" + createAttributesKey(primitiveDef.attributes) + ":" + primitiveDef.mode;
      }
      return geometryKey;
    }
    function createAttributesKey(attributes) {
      var attributesKey = "";
      var keys = Object.keys(attributes).sort();
      for (var i = 0, il = keys.length; i < il; i++) {
        attributesKey += keys[i] + ":" + attributes[keys[i]] + ";";
      }
      return attributesKey;
    }
    function cloneBufferAttribute(attribute) {
      if (attribute.isInterleavedBufferAttribute) {
        var count = attribute.count;
        var itemSize = attribute.itemSize;
        var array = attribute.array.slice(0, count * itemSize);
        for (var i = 0, j = 0; i < count; ++i) {
          array[j++] = attribute.getX(i);
          if (itemSize >= 2)
            array[j++] = attribute.getY(i);
          if (itemSize >= 3)
            array[j++] = attribute.getZ(i);
          if (itemSize >= 4)
            array[j++] = attribute.getW(i);
        }
        return new THREE.BufferAttribute(array, itemSize, attribute.normalized);
      }
      return attribute.clone();
    }
    function GLTFParser(json, extensions, options) {
      this.json = json || {};
      this.extensions = extensions || {};
      this.options = options || {};
      this.cache = new GLTFRegistry();
      this.primitiveCache = {};
      this.textureLoader = new THREE.TextureLoader(this.options.manager);
      this.textureLoader.setCrossOrigin(this.options.crossOrigin);
      this.fileLoader = new THREE.FileLoader(this.options.manager);
      this.fileLoader.setResponseType("arraybuffer");
      if (this.options.crossOrigin === "use-credentials") {
        this.fileLoader.setWithCredentials(true);
      }
    }
    GLTFParser.prototype.parse = function(onLoad, onError) {
      var parser = this;
      var json = this.json;
      var extensions = this.extensions;
      this.cache.removeAll();
      this.markDefs();
      Promise.all([
        this.getDependencies("scene"),
        this.getDependencies("animation"),
        this.getDependencies("camera")
      ]).then(function(dependencies) {
        var result = {
          scene: dependencies[0][json.scene || 0],
          scenes: dependencies[0],
          animations: dependencies[1],
          cameras: dependencies[2],
          asset: json.asset,
          parser,
          userData: {}
        };
        addUnknownExtensionsToUserData(extensions, result, json);
        assignExtrasToUserData(result, json);
        onLoad(result);
      }).catch(onError);
    };
    GLTFParser.prototype.markDefs = function() {
      var nodeDefs = this.json.nodes || [];
      var skinDefs = this.json.skins || [];
      var meshDefs = this.json.meshes || [];
      var meshReferences = {};
      var meshUses = {};
      for (var skinIndex = 0, skinLength = skinDefs.length; skinIndex < skinLength; skinIndex++) {
        var joints = skinDefs[skinIndex].joints;
        for (var i = 0, il = joints.length; i < il; i++) {
          nodeDefs[joints[i]].isBone = true;
        }
      }
      for (var nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex++) {
        var nodeDef = nodeDefs[nodeIndex];
        if (nodeDef.mesh !== void 0) {
          if (meshReferences[nodeDef.mesh] === void 0) {
            meshReferences[nodeDef.mesh] = meshUses[nodeDef.mesh] = 0;
          }
          meshReferences[nodeDef.mesh]++;
          if (nodeDef.skin !== void 0) {
            meshDefs[nodeDef.mesh].isSkinnedMesh = true;
          }
        }
      }
      this.json.meshReferences = meshReferences;
      this.json.meshUses = meshUses;
    };
    GLTFParser.prototype.getDependency = function(type, index) {
      var cacheKey = type + ":" + index;
      var dependency = this.cache.get(cacheKey);
      if (!dependency) {
        switch (type) {
          case "scene":
            dependency = this.loadScene(index);
            break;
          case "node":
            dependency = this.loadNode(index);
            break;
          case "mesh":
            dependency = this.loadMesh(index);
            break;
          case "accessor":
            dependency = this.loadAccessor(index);
            break;
          case "bufferView":
            dependency = this.loadBufferView(index);
            break;
          case "buffer":
            dependency = this.loadBuffer(index);
            break;
          case "material":
            dependency = this.loadMaterial(index);
            break;
          case "texture":
            dependency = this.loadTexture(index);
            break;
          case "skin":
            dependency = this.loadSkin(index);
            break;
          case "animation":
            dependency = this.loadAnimation(index);
            break;
          case "camera":
            dependency = this.loadCamera(index);
            break;
          case "light":
            dependency = this.extensions[EXTENSIONS.KHR_LIGHTS_PUNCTUAL].loadLight(index);
            break;
          default:
            throw new Error("Unknown type: " + type);
        }
        this.cache.add(cacheKey, dependency);
      }
      return dependency;
    };
    GLTFParser.prototype.getDependencies = function(type) {
      var dependencies = this.cache.get(type);
      if (!dependencies) {
        var parser = this;
        var defs = this.json[type + (type === "mesh" ? "es" : "s")] || [];
        dependencies = Promise.all(defs.map(function(def, index) {
          return parser.getDependency(type, index);
        }));
        this.cache.add(type, dependencies);
      }
      return dependencies;
    };
    GLTFParser.prototype.loadBuffer = function(bufferIndex) {
      var bufferDef = this.json.buffers[bufferIndex];
      var loader = this.fileLoader;
      if (bufferDef.type && bufferDef.type !== "arraybuffer") {
        throw new Error("THREE.GLTFLoader: " + bufferDef.type + " buffer type is not supported.");
      }
      if (bufferDef.uri === void 0 && bufferIndex === 0) {
        return Promise.resolve(this.extensions[EXTENSIONS.KHR_BINARY_GLTF].body);
      }
      var options = this.options;
      return new Promise(function(resolve, reject) {
        loader.load(resolveURL(bufferDef.uri, options.path), resolve, void 0, function() {
          reject(new Error('THREE.GLTFLoader: Failed to load buffer "' + bufferDef.uri + '".'));
        });
      });
    };
    GLTFParser.prototype.loadBufferView = function(bufferViewIndex) {
      var bufferViewDef = this.json.bufferViews[bufferViewIndex];
      return this.getDependency("buffer", bufferViewDef.buffer).then(function(buffer) {
        var byteLength = bufferViewDef.byteLength || 0;
        var byteOffset = bufferViewDef.byteOffset || 0;
        return buffer.slice(byteOffset, byteOffset + byteLength);
      });
    };
    GLTFParser.prototype.loadAccessor = function(accessorIndex) {
      var parser = this;
      var json = this.json;
      var accessorDef = this.json.accessors[accessorIndex];
      if (accessorDef.bufferView === void 0 && accessorDef.sparse === void 0) {
        return Promise.resolve(null);
      }
      var pendingBufferViews = [];
      if (accessorDef.bufferView !== void 0) {
        pendingBufferViews.push(this.getDependency("bufferView", accessorDef.bufferView));
      } else {
        pendingBufferViews.push(null);
      }
      if (accessorDef.sparse !== void 0) {
        pendingBufferViews.push(this.getDependency("bufferView", accessorDef.sparse.indices.bufferView));
        pendingBufferViews.push(this.getDependency("bufferView", accessorDef.sparse.values.bufferView));
      }
      return Promise.all(pendingBufferViews).then(function(bufferViews) {
        var bufferView = bufferViews[0];
        var itemSize = WEBGL_TYPE_SIZES[accessorDef.type];
        var TypedArray = WEBGL_COMPONENT_TYPES[accessorDef.componentType];
        var elementBytes = TypedArray.BYTES_PER_ELEMENT;
        var itemBytes = elementBytes * itemSize;
        var byteOffset = accessorDef.byteOffset || 0;
        var byteStride = accessorDef.bufferView !== void 0 ? json.bufferViews[accessorDef.bufferView].byteStride : void 0;
        var normalized = accessorDef.normalized === true;
        var array, bufferAttribute;
        if (byteStride && byteStride !== itemBytes) {
          var ibSlice = Math.floor(byteOffset / byteStride);
          var ibCacheKey = "InterleavedBuffer:" + accessorDef.bufferView + ":" + accessorDef.componentType + ":" + ibSlice + ":" + accessorDef.count;
          var ib = parser.cache.get(ibCacheKey);
          if (!ib) {
            array = new TypedArray(bufferView, ibSlice * byteStride, accessorDef.count * byteStride / elementBytes);
            ib = new THREE.InterleavedBuffer(array, byteStride / elementBytes);
            parser.cache.add(ibCacheKey, ib);
          }
          bufferAttribute = new THREE.InterleavedBufferAttribute(ib, itemSize, byteOffset % byteStride / elementBytes, normalized);
        } else {
          if (bufferView === null) {
            array = new TypedArray(accessorDef.count * itemSize);
          } else {
            array = new TypedArray(bufferView, byteOffset, accessorDef.count * itemSize);
          }
          bufferAttribute = new THREE.BufferAttribute(array, itemSize, normalized);
        }
        if (accessorDef.sparse !== void 0) {
          var itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR;
          var TypedArrayIndices = WEBGL_COMPONENT_TYPES[accessorDef.sparse.indices.componentType];
          var byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0;
          var byteOffsetValues = accessorDef.sparse.values.byteOffset || 0;
          var sparseIndices = new TypedArrayIndices(bufferViews[1], byteOffsetIndices, accessorDef.sparse.count * itemSizeIndices);
          var sparseValues = new TypedArray(bufferViews[2], byteOffsetValues, accessorDef.sparse.count * itemSize);
          if (bufferView !== null) {
            bufferAttribute.setArray(bufferAttribute.array.slice());
          }
          for (var i = 0, il = sparseIndices.length; i < il; i++) {
            var index = sparseIndices[i];
            bufferAttribute.setX(index, sparseValues[i * itemSize]);
            if (itemSize >= 2)
              bufferAttribute.setY(index, sparseValues[i * itemSize + 1]);
            if (itemSize >= 3)
              bufferAttribute.setZ(index, sparseValues[i * itemSize + 2]);
            if (itemSize >= 4)
              bufferAttribute.setW(index, sparseValues[i * itemSize + 3]);
            if (itemSize >= 5)
              throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.");
          }
        }
        return bufferAttribute;
      });
    };
    GLTFParser.prototype.loadTexture = function(textureIndex) {
      var parser = this;
      var json = this.json;
      var options = this.options;
      var textureLoader = this.textureLoader;
      var URL = "";
      var textureDef = json.textures[textureIndex];
      var textureExtensions = textureDef.extensions || {};
      var source;
      if (textureExtensions[EXTENSIONS.MSFT_TEXTURE_DDS]) {
        source = json.images[textureExtensions[EXTENSIONS.MSFT_TEXTURE_DDS].source];
      } else {
        source = json.images[textureDef.source];
      }
      var sourceURI = source.uri;
      var isObjectURL = false;
      if (source.bufferView !== void 0) {
        sourceURI = parser.getDependency("bufferView", source.bufferView).then(function(bufferView) {
          isObjectURL = true;
          var blob = new Blob([bufferView], { type: source.mimeType });
          sourceURI = URL.createObjectURL(blob);
          return sourceURI;
        });
      }
      return Promise.resolve(sourceURI).then(function(sourceURI2) {
        var loader = THREE.Loader.Handlers.get(sourceURI2);
        if (!loader) {
          loader = textureExtensions[EXTENSIONS.MSFT_TEXTURE_DDS] ? parser.extensions[EXTENSIONS.MSFT_TEXTURE_DDS].ddsLoader : textureLoader;
        }
        return new Promise(function(resolve, reject) {
          var revsolvedURI = resolveURL(sourceURI2, options.path);
          console.log(loader);
          loader.load(revsolvedURI, resolve, void 0, reject);
        });
      }).then(function(texture) {
        if (isObjectURL === true) {
          URL.revokeObjectURL(sourceURI);
        }
        texture.flipY = false;
        if (textureDef.name !== void 0)
          texture.name = textureDef.name;
        if (source.mimeType in MIME_TYPE_FORMATS) {
          texture.format = MIME_TYPE_FORMATS[source.mimeType];
        }
        var samplers = json.samplers || {};
        var sampler = samplers[textureDef.sampler] || {};
        texture.magFilter = WEBGL_FILTERS[sampler.magFilter] || THREE.LinearFilter;
        texture.minFilter = WEBGL_FILTERS[sampler.minFilter] || THREE.LinearMipmapLinearFilter;
        texture.wrapS = WEBGL_WRAPPINGS[sampler.wrapS] || THREE.RepeatWrapping;
        texture.wrapT = WEBGL_WRAPPINGS[sampler.wrapT] || THREE.RepeatWrapping;
        return texture;
      });
    };
    GLTFParser.prototype.assignTexture = function(materialParams, mapName, mapDef) {
      var parser = this;
      return this.getDependency("texture", mapDef.index).then(function(texture) {
        if (!texture.isCompressedTexture) {
          switch (mapName) {
            case "aoMap":
            case "emissiveMap":
            case "metalnessMap":
            case "normalMap":
            case "roughnessMap":
              texture.format = THREE.RGBFormat;
              break;
          }
        }
        if (parser.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM]) {
          var transform = mapDef.extensions !== void 0 ? mapDef.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM] : void 0;
          if (transform) {
            texture = parser.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM].extendTexture(texture, transform);
          }
        }
        materialParams[mapName] = texture;
      });
    };
    GLTFParser.prototype.assignFinalMaterial = function(mesh) {
      var geometry = mesh.geometry;
      var material = mesh.material;
      var extensions = this.extensions;
      var useVertexTangents = geometry.attributes.tangent !== void 0;
      var useVertexColors = geometry.attributes.color !== void 0;
      var useFlatShading = geometry.attributes.normal === void 0;
      var useSkinning = mesh.isSkinnedMesh === true;
      var useMorphTargets = Object.keys(geometry.morphAttributes).length > 0;
      var useMorphNormals = useMorphTargets && geometry.morphAttributes.normal !== void 0;
      if (mesh.isPoints) {
        var cacheKey = "PointsMaterial:" + material.uuid;
        var pointsMaterial = this.cache.get(cacheKey);
        if (!pointsMaterial) {
          pointsMaterial = new THREE.PointsMaterial();
          THREE.Material.prototype.copy.call(pointsMaterial, material);
          pointsMaterial.color.copy(material.color);
          pointsMaterial.map = material.map;
          pointsMaterial.lights = false;
          pointsMaterial.sizeAttenuation = false;
          this.cache.add(cacheKey, pointsMaterial);
        }
        material = pointsMaterial;
      } else if (mesh.isLine) {
        var cacheKey = "LineBasicMaterial:" + material.uuid;
        var lineMaterial = this.cache.get(cacheKey);
        if (!lineMaterial) {
          lineMaterial = new THREE.LineBasicMaterial();
          THREE.Material.prototype.copy.call(lineMaterial, material);
          lineMaterial.color.copy(material.color);
          lineMaterial.lights = false;
          this.cache.add(cacheKey, lineMaterial);
        }
        material = lineMaterial;
      }
      if (useVertexTangents || useVertexColors || useFlatShading || useSkinning || useMorphTargets) {
        var cacheKey = "ClonedMaterial:" + material.uuid + ":";
        if (material.isGLTFSpecularGlossinessMaterial)
          cacheKey += "specular-glossiness:";
        if (useSkinning)
          cacheKey += "skinning:";
        if (useVertexTangents)
          cacheKey += "vertex-tangents:";
        if (useVertexColors)
          cacheKey += "vertex-colors:";
        if (useFlatShading)
          cacheKey += "flat-shading:";
        if (useMorphTargets)
          cacheKey += "morph-targets:";
        if (useMorphNormals)
          cacheKey += "morph-normals:";
        var cachedMaterial = this.cache.get(cacheKey);
        if (!cachedMaterial) {
          cachedMaterial = material.isGLTFSpecularGlossinessMaterial ? extensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS].cloneMaterial(material) : material.clone();
          if (useSkinning)
            cachedMaterial.skinning = true;
          if (useVertexTangents)
            cachedMaterial.vertexTangents = true;
          if (useVertexColors)
            cachedMaterial.vertexColors = THREE.VertexColors;
          if (useFlatShading)
            cachedMaterial.flatShading = true;
          if (useMorphTargets)
            cachedMaterial.morphTargets = true;
          if (useMorphNormals)
            cachedMaterial.morphNormals = true;
          this.cache.add(cacheKey, cachedMaterial);
        }
        material = cachedMaterial;
      }
      if (material.aoMap && geometry.attributes.uv2 === void 0 && geometry.attributes.uv !== void 0) {
        console.log("THREE.GLTFLoader: Duplicating UVs to support aoMap.");
        geometry.addAttribute("uv2", new THREE.BufferAttribute(geometry.attributes.uv.array, 2));
      }
      if (material.isGLTFSpecularGlossinessMaterial) {
        mesh.onBeforeRender = extensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS].refreshUniforms;
      }
      mesh.material = material;
    };
    GLTFParser.prototype.loadMaterial = function(materialIndex) {
      var parser = this;
      var json = this.json;
      var extensions = this.extensions;
      var materialDef = json.materials[materialIndex];
      var materialType;
      var materialParams = {};
      var materialExtensions = materialDef.extensions || {};
      var pending = [];
      if (materialExtensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS]) {
        var sgExtension = extensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS];
        materialType = sgExtension.getMaterialType();
        pending.push(sgExtension.extendParams(materialParams, materialDef, parser));
      } else if (materialExtensions[EXTENSIONS.KHR_MATERIALS_UNLIT]) {
        var kmuExtension = extensions[EXTENSIONS.KHR_MATERIALS_UNLIT];
        materialType = kmuExtension.getMaterialType();
        pending.push(kmuExtension.extendParams(materialParams, materialDef, parser));
      } else {
        materialType = THREE.MeshStandardMaterial;
        var metallicRoughness = materialDef.pbrMetallicRoughness || {};
        materialParams.color = new THREE.Color(1, 1, 1);
        materialParams.opacity = 1;
        if (Array.isArray(metallicRoughness.baseColorFactor)) {
          var array = metallicRoughness.baseColorFactor;
          materialParams.color.fromArray(array);
          materialParams.opacity = array[3];
        }
        if (metallicRoughness.baseColorTexture !== void 0) {
          pending.push(parser.assignTexture(materialParams, "map", metallicRoughness.baseColorTexture));
        }
        materialParams.metalness = metallicRoughness.metallicFactor !== void 0 ? metallicRoughness.metallicFactor : 1;
        materialParams.roughness = metallicRoughness.roughnessFactor !== void 0 ? metallicRoughness.roughnessFactor : 1;
        if (metallicRoughness.metallicRoughnessTexture !== void 0) {
          pending.push(parser.assignTexture(materialParams, "metalnessMap", metallicRoughness.metallicRoughnessTexture));
          pending.push(parser.assignTexture(materialParams, "roughnessMap", metallicRoughness.metallicRoughnessTexture));
        }
      }
      if (materialDef.doubleSided === true) {
        materialParams.side = THREE.DoubleSide;
      }
      var alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;
      if (alphaMode === ALPHA_MODES.BLEND) {
        materialParams.transparent = true;
      } else {
        materialParams.transparent = false;
        if (alphaMode === ALPHA_MODES.MASK) {
          materialParams.alphaTest = materialDef.alphaCutoff !== void 0 ? materialDef.alphaCutoff : 0.5;
        }
      }
      if (materialDef.normalTexture !== void 0 && materialType !== THREE.MeshBasicMaterial) {
        pending.push(parser.assignTexture(materialParams, "normalMap", materialDef.normalTexture));
        materialParams.normalScale = new THREE.Vector2(1, 1);
        if (materialDef.normalTexture.scale !== void 0) {
          materialParams.normalScale.set(materialDef.normalTexture.scale, materialDef.normalTexture.scale);
        }
      }
      if (materialDef.occlusionTexture !== void 0 && materialType !== THREE.MeshBasicMaterial) {
        pending.push(parser.assignTexture(materialParams, "aoMap", materialDef.occlusionTexture));
        if (materialDef.occlusionTexture.strength !== void 0) {
          materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;
        }
      }
      if (materialDef.emissiveFactor !== void 0 && materialType !== THREE.MeshBasicMaterial) {
        materialParams.emissive = new THREE.Color().fromArray(materialDef.emissiveFactor);
      }
      if (materialDef.emissiveTexture !== void 0 && materialType !== THREE.MeshBasicMaterial) {
        pending.push(parser.assignTexture(materialParams, "emissiveMap", materialDef.emissiveTexture));
      }
      return Promise.all(pending).then(function() {
        var material;
        if (materialType === THREE.ShaderMaterial) {
          material = extensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS].createMaterial(materialParams);
        } else {
          material = new materialType(materialParams);
        }
        if (materialDef.name !== void 0)
          material.name = materialDef.name;
        if (material.map)
          material.map.encoding = THREE.sRGBEncoding;
        if (material.emissiveMap)
          material.emissiveMap.encoding = THREE.sRGBEncoding;
        if (material.specularMap)
          material.specularMap.encoding = THREE.sRGBEncoding;
        assignExtrasToUserData(material, materialDef);
        if (materialDef.extensions)
          addUnknownExtensionsToUserData(extensions, material, materialDef);
        return material;
      });
    };
    function addPrimitiveAttributes(geometry, primitiveDef, parser) {
      var attributes = primitiveDef.attributes;
      var pending = [];
      function assignAttributeAccessor(accessorIndex, attributeName) {
        return parser.getDependency("accessor", accessorIndex).then(function(accessor2) {
          geometry.addAttribute(attributeName, accessor2);
        });
      }
      for (var gltfAttributeName in attributes) {
        var threeAttributeName = ATTRIBUTES[gltfAttributeName] || gltfAttributeName.toLowerCase();
        if (threeAttributeName in geometry.attributes)
          continue;
        pending.push(assignAttributeAccessor(attributes[gltfAttributeName], threeAttributeName));
      }
      if (primitiveDef.indices !== void 0 && !geometry.index) {
        var accessor = parser.getDependency("accessor", primitiveDef.indices).then(function(accessor2) {
          geometry.setIndex(accessor2);
        });
        pending.push(accessor);
      }
      assignExtrasToUserData(geometry, primitiveDef);
      return Promise.all(pending).then(function() {
        return primitiveDef.targets !== void 0 ? addMorphTargets(geometry, primitiveDef.targets, parser) : geometry;
      });
    }
    GLTFParser.prototype.loadGeometries = function(primitives) {
      var parser = this;
      var extensions = this.extensions;
      var cache = this.primitiveCache;
      function createDracoPrimitive(primitive2) {
        return extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(primitive2, parser).then(function(geometry) {
          return addPrimitiveAttributes(geometry, primitive2, parser);
        });
      }
      var pending = [];
      for (var i = 0, il = primitives.length; i < il; i++) {
        var primitive = primitives[i];
        var cacheKey = createPrimitiveKey(primitive);
        var cached = cache[cacheKey];
        if (cached) {
          pending.push(cached.promise);
        } else {
          var geometryPromise;
          if (primitive.extensions && primitive.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION]) {
            geometryPromise = createDracoPrimitive(primitive);
          } else {
            geometryPromise = addPrimitiveAttributes(new THREE.BufferGeometry(), primitive, parser);
          }
          cache[cacheKey] = { primitive, promise: geometryPromise };
          pending.push(geometryPromise);
        }
      }
      return Promise.all(pending);
    };
    GLTFParser.prototype.loadMesh = function(meshIndex) {
      var parser = this;
      var json = this.json;
      var meshDef = json.meshes[meshIndex];
      var primitives = meshDef.primitives;
      var pending = [];
      for (var i = 0, il = primitives.length; i < il; i++) {
        var material = primitives[i].material === void 0 ? createDefaultMaterial() : this.getDependency("material", primitives[i].material);
        pending.push(material);
      }
      return Promise.all(pending).then(function(originalMaterials) {
        return parser.loadGeometries(primitives).then(function(geometries) {
          var meshes = [];
          for (var i2 = 0, il2 = geometries.length; i2 < il2; i2++) {
            var geometry = geometries[i2];
            var primitive = primitives[i2];
            var mesh;
            var material2 = originalMaterials[i2];
            if (primitive.mode === WEBGL_CONSTANTS.TRIANGLES || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN || primitive.mode === void 0) {
              mesh = meshDef.isSkinnedMesh === true ? new THREE.SkinnedMesh(geometry, material2) : new THREE.Mesh(geometry, material2);
              if (mesh.isSkinnedMesh === true && !mesh.geometry.attributes.skinWeight.normalized) {
                mesh.normalizeSkinWeights();
              }
              if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP) {
                mesh.drawMode = THREE.TriangleStripDrawMode;
              } else if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN) {
                mesh.drawMode = THREE.TriangleFanDrawMode;
              }
            } else if (primitive.mode === WEBGL_CONSTANTS.LINES) {
              mesh = new THREE.LineSegments(geometry, material2);
            } else if (primitive.mode === WEBGL_CONSTANTS.LINE_STRIP) {
              mesh = new THREE.Line(geometry, material2);
            } else if (primitive.mode === WEBGL_CONSTANTS.LINE_LOOP) {
              mesh = new THREE.LineLoop(geometry, material2);
            } else if (primitive.mode === WEBGL_CONSTANTS.POINTS) {
              mesh = new THREE.Points(geometry, material2);
            } else {
              throw new Error("THREE.GLTFLoader: Primitive mode unsupported: " + primitive.mode);
            }
            if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
              updateMorphTargets(mesh, meshDef);
            }
            mesh.name = meshDef.name || "mesh_" + meshIndex;
            if (geometries.length > 1)
              mesh.name += "_" + i2;
            assignExtrasToUserData(mesh, meshDef);
            parser.assignFinalMaterial(mesh);
            meshes.push(mesh);
          }
          if (meshes.length === 1) {
            return meshes[0];
          }
          var group = new THREE.Group();
          for (var i2 = 0, il2 = meshes.length; i2 < il2; i2++) {
            group.add(meshes[i2]);
          }
          return group;
        });
      });
    };
    GLTFParser.prototype.loadCamera = function(cameraIndex) {
      var camera;
      var cameraDef = this.json.cameras[cameraIndex];
      var params = cameraDef[cameraDef.type];
      if (!params) {
        console.warn("THREE.GLTFLoader: Missing camera parameters.");
        return;
      }
      if (cameraDef.type === "perspective") {
        camera = new THREE.PerspectiveCamera(THREE.Math.radToDeg(params.yfov), params.aspectRatio || 1, params.znear || 1, params.zfar || 2e6);
      } else if (cameraDef.type === "orthographic") {
        camera = new THREE.OrthographicCamera(params.xmag / -2, params.xmag / 2, params.ymag / 2, params.ymag / -2, params.znear, params.zfar);
      }
      if (cameraDef.name !== void 0)
        camera.name = cameraDef.name;
      assignExtrasToUserData(camera, cameraDef);
      return Promise.resolve(camera);
    };
    GLTFParser.prototype.loadSkin = function(skinIndex) {
      var skinDef = this.json.skins[skinIndex];
      var skinEntry = { joints: skinDef.joints };
      if (skinDef.inverseBindMatrices === void 0) {
        return Promise.resolve(skinEntry);
      }
      return this.getDependency("accessor", skinDef.inverseBindMatrices).then(function(accessor) {
        skinEntry.inverseBindMatrices = accessor;
        return skinEntry;
      });
    };
    GLTFParser.prototype.loadAnimation = function(animationIndex) {
      var json = this.json;
      var animationDef = json.animations[animationIndex];
      var pendingNodes = [];
      var pendingInputAccessors = [];
      var pendingOutputAccessors = [];
      var pendingSamplers = [];
      var pendingTargets = [];
      for (var i = 0, il = animationDef.channels.length; i < il; i++) {
        var channel = animationDef.channels[i];
        var sampler = animationDef.samplers[channel.sampler];
        var target = channel.target;
        var name = target.node !== void 0 ? target.node : target.id;
        var input = animationDef.parameters !== void 0 ? animationDef.parameters[sampler.input] : sampler.input;
        var output = animationDef.parameters !== void 0 ? animationDef.parameters[sampler.output] : sampler.output;
        pendingNodes.push(this.getDependency("node", name));
        pendingInputAccessors.push(this.getDependency("accessor", input));
        pendingOutputAccessors.push(this.getDependency("accessor", output));
        pendingSamplers.push(sampler);
        pendingTargets.push(target);
      }
      return Promise.all([
        Promise.all(pendingNodes),
        Promise.all(pendingInputAccessors),
        Promise.all(pendingOutputAccessors),
        Promise.all(pendingSamplers),
        Promise.all(pendingTargets)
      ]).then(function(dependencies) {
        var nodes = dependencies[0];
        var inputAccessors = dependencies[1];
        var outputAccessors = dependencies[2];
        var samplers = dependencies[3];
        var targets = dependencies[4];
        var tracks = [];
        for (var i2 = 0, il2 = nodes.length; i2 < il2; i2++) {
          var node = nodes[i2];
          var inputAccessor = inputAccessors[i2];
          var outputAccessor = outputAccessors[i2];
          var sampler2 = samplers[i2];
          var target2 = targets[i2];
          if (node === void 0)
            continue;
          node.updateMatrix();
          node.matrixAutoUpdate = true;
          var TypedKeyframeTrack;
          switch (PATH_PROPERTIES[target2.path]) {
            case PATH_PROPERTIES.weights:
              TypedKeyframeTrack = THREE.NumberKeyframeTrack;
              break;
            case PATH_PROPERTIES.rotation:
              TypedKeyframeTrack = THREE.QuaternionKeyframeTrack;
              break;
            case PATH_PROPERTIES.position:
            case PATH_PROPERTIES.scale:
            default:
              TypedKeyframeTrack = THREE.VectorKeyframeTrack;
              break;
          }
          var targetName = node.name ? node.name : node.uuid;
          var interpolation = sampler2.interpolation !== void 0 ? INTERPOLATION[sampler2.interpolation] : THREE.InterpolateLinear;
          var targetNames = [];
          if (PATH_PROPERTIES[target2.path] === PATH_PROPERTIES.weights) {
            node.traverse(function(object) {
              if (object.isMesh === true && object.morphTargetInfluences) {
                targetNames.push(object.name ? object.name : object.uuid);
              }
            });
          } else {
            targetNames.push(targetName);
          }
          var outputArray = outputAccessor.array;
          if (outputAccessor.normalized) {
            var scale;
            if (outputArray.constructor === Int8Array) {
              scale = 1 / 127;
            } else if (outputArray.constructor === Uint8Array) {
              scale = 1 / 255;
            } else if (outputArray.constructor == Int16Array) {
              scale = 1 / 32767;
            } else if (outputArray.constructor === Uint16Array) {
              scale = 1 / 65535;
            } else {
              throw new Error("THREE.GLTFLoader: Unsupported output accessor component type.");
            }
            var scaled = new Float32Array(outputArray.length);
            for (var j = 0, jl = outputArray.length; j < jl; j++) {
              scaled[j] = outputArray[j] * scale;
            }
            outputArray = scaled;
          }
          for (var j = 0, jl = targetNames.length; j < jl; j++) {
            var track = new TypedKeyframeTrack(
              targetNames[j] + "." + PATH_PROPERTIES[target2.path],
              inputAccessor.array,
              outputArray,
              interpolation
            );
            if (sampler2.interpolation === "CUBICSPLINE") {
              track.createInterpolant = function InterpolantFactoryMethodGLTFCubicSpline(result) {
                return new GLTFCubicSplineInterpolant(this.times, this.values, this.getValueSize() / 3, result);
              };
              track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;
            }
            tracks.push(track);
          }
        }
        var name2 = animationDef.name !== void 0 ? animationDef.name : "animation_" + animationIndex;
        return new THREE.AnimationClip(name2, void 0, tracks);
      });
    };
    GLTFParser.prototype.loadNode = function(nodeIndex) {
      var json = this.json;
      var extensions = this.extensions;
      var parser = this;
      var meshReferences = json.meshReferences;
      var meshUses = json.meshUses;
      var nodeDef = json.nodes[nodeIndex];
      return function() {
        var pending = [];
        if (nodeDef.mesh !== void 0) {
          pending.push(parser.getDependency("mesh", nodeDef.mesh).then(function(mesh) {
            var node;
            if (meshReferences[nodeDef.mesh] > 1) {
              var instanceNum = meshUses[nodeDef.mesh]++;
              node = mesh.clone();
              node.name += "_instance_" + instanceNum;
              node.onBeforeRender = mesh.onBeforeRender;
              for (var i = 0, il = node.children.length; i < il; i++) {
                node.children[i].name += "_instance_" + instanceNum;
                node.children[i].onBeforeRender = mesh.children[i].onBeforeRender;
              }
            } else {
              node = mesh;
            }
            if (nodeDef.weights !== void 0) {
              node.traverse(function(o) {
                if (!o.isMesh)
                  return;
                for (var i2 = 0, il2 = nodeDef.weights.length; i2 < il2; i2++) {
                  o.morphTargetInfluences[i2] = nodeDef.weights[i2];
                }
              });
            }
            return node;
          }));
        }
        if (nodeDef.camera !== void 0) {
          pending.push(parser.getDependency("camera", nodeDef.camera));
        }
        if (nodeDef.extensions && nodeDef.extensions[EXTENSIONS.KHR_LIGHTS_PUNCTUAL] && nodeDef.extensions[EXTENSIONS.KHR_LIGHTS_PUNCTUAL].light !== void 0) {
          pending.push(parser.getDependency("light", nodeDef.extensions[EXTENSIONS.KHR_LIGHTS_PUNCTUAL].light));
        }
        return Promise.all(pending);
      }().then(function(objects) {
        var node;
        if (nodeDef.isBone === true) {
          node = new THREE.Bone();
        } else if (objects.length > 1) {
          node = new THREE.Group();
        } else if (objects.length === 1) {
          node = objects[0];
        } else {
          node = new THREE.Object3D();
        }
        if (node !== objects[0]) {
          for (var i = 0, il = objects.length; i < il; i++) {
            node.add(objects[i]);
          }
        }
        if (nodeDef.name !== void 0) {
          node.userData.name = nodeDef.name;
          node.name = THREE.PropertyBinding.sanitizeNodeName(nodeDef.name);
        }
        assignExtrasToUserData(node, nodeDef);
        if (nodeDef.extensions)
          addUnknownExtensionsToUserData(extensions, node, nodeDef);
        if (nodeDef.matrix !== void 0) {
          var matrix = new THREE.Matrix4();
          matrix.fromArray(nodeDef.matrix);
          node.applyMatrix(matrix);
        } else {
          if (nodeDef.translation !== void 0) {
            node.position.fromArray(nodeDef.translation);
          }
          if (nodeDef.rotation !== void 0) {
            node.quaternion.fromArray(nodeDef.rotation);
          }
          if (nodeDef.scale !== void 0) {
            node.scale.fromArray(nodeDef.scale);
          }
        }
        return node;
      });
    };
    GLTFParser.prototype.loadScene = function() {
      function buildNodeHierachy(nodeId, parentObject, json, parser) {
        var nodeDef = json.nodes[nodeId];
        return parser.getDependency("node", nodeId).then(function(node) {
          if (nodeDef.skin === void 0)
            return node;
          var skinEntry;
          return parser.getDependency("skin", nodeDef.skin).then(function(skin) {
            skinEntry = skin;
            var pendingJoints = [];
            for (var i = 0, il = skinEntry.joints.length; i < il; i++) {
              pendingJoints.push(parser.getDependency("node", skinEntry.joints[i]));
            }
            return Promise.all(pendingJoints);
          }).then(function(jointNodes) {
            node.traverse(function(mesh) {
              if (!mesh.isMesh)
                return;
              var bones = [];
              var boneInverses = [];
              for (var j = 0, jl = jointNodes.length; j < jl; j++) {
                var jointNode = jointNodes[j];
                if (jointNode) {
                  bones.push(jointNode);
                  var mat = new THREE.Matrix4();
                  if (skinEntry.inverseBindMatrices !== void 0) {
                    mat.fromArray(skinEntry.inverseBindMatrices.array, j * 16);
                  }
                  boneInverses.push(mat);
                } else {
                  console.warn('THREE.GLTFLoader: Joint "%s" could not be found.', skinEntry.joints[j]);
                }
              }
              mesh.bind(new THREE.Skeleton(bones, boneInverses), mesh.matrixWorld);
            });
            return node;
          });
        }).then(function(node) {
          parentObject.add(node);
          var pending = [];
          if (nodeDef.children) {
            var children = nodeDef.children;
            for (var i = 0, il = children.length; i < il; i++) {
              var child = children[i];
              pending.push(buildNodeHierachy(child, node, json, parser));
            }
          }
          return Promise.all(pending);
        });
      }
      return function loadScene(sceneIndex) {
        var json = this.json;
        var extensions = this.extensions;
        var sceneDef = this.json.scenes[sceneIndex];
        var parser = this;
        var scene = new THREE.Scene();
        if (sceneDef.name !== void 0)
          scene.name = sceneDef.name;
        assignExtrasToUserData(scene, sceneDef);
        if (sceneDef.extensions)
          addUnknownExtensionsToUserData(extensions, scene, sceneDef);
        var nodeIds = sceneDef.nodes || [];
        var pending = [];
        for (var i = 0, il = nodeIds.length; i < il; i++) {
          pending.push(buildNodeHierachy(nodeIds[i], scene, json, parser));
        }
        return Promise.all(pending).then(function() {
          return scene;
        });
      };
    }();
    return GLTFLoader;
  }();
}
exports.registerGLTFLoader = registerGLTFLoader;
