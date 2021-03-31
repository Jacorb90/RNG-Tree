function createLayers() {
	let seed = getSeed();
	let layersForEffects = [["NONE"]];
	for (let r=1;r<=RNG_DATA.rows;r++) {
		layersForEffects.push([]);
		let layersInRow = RNG_DATA.layers(r);
		for (let l=1;l<=layersInRow;l++) {
			let rand = random(seed*random(r*l));
			let layerName = RNG_DATA.chars[Math.floor(rand*RNG_DATA.chars.length)];
			RNG_DATA.chars = RNG_DATA.chars.filter(x => x!=layerName);
			let baseResNum = (r==1?0:Math.floor(rand*(Object.keys(ROW_LAYERS[r-1]).length+1)));
			let baseResName = (baseResNum==0?"":Object.keys(ROW_LAYERS[r-1])[baseResNum-1]);
			let layerType = r==1?"normal":RNG_DATA.types[Math.floor(rand*RNG_DATA.types.length)];
			let layerReq;
			if (baseResName=="") layerReq = RNG_DATA.rowReqs[r].times(rand+0.5)
			else {
				if (layers[baseResName].type=="static") layerReq = RNG_DATA.rowReqs[r].root(layers[baseResName].exponent).log(layers[baseResName].base).times(rand+0.5)
				else layerReq = RNG_DATA.rowReqs[r].pow(layers[baseResName].exponent).times(rand+0.5).times(2)
			}
			layersForEffects[r].push(layerName);
			
			let layerInfo = {
				name: layerName,
				symbol: layerName,
				position: (l-1),
				color: ("#"+Math.floor(rand*16777215).toString(16)),
				requires: layerReq,
				resource: (layerName+" points"),
				baseResNum: baseResNum,
				baseResName: baseResName,
				baseResource() { return ((this.baseResNum==0)?"points":(this.baseResName+" points")) },
				baseAmount() { return (this.baseResNum==0?player.points:player[this.baseResName].points) },
				type: layerType,
				row: r,
				layerShown() { return (r==1?true:Object.keys(ROW_LAYERS[r-1]).some(x => player[x].unlocked)) },
				doReset(resettingLayer) {
					let keep = [];
					if (layers[resettingLayer].row > this.row) layerDataReset(this.name, keep)
				},
				startData() { return {
					unlocked: false,
					points: new Decimal(0),
					best: new Decimal(0),
					total: new Decimal(0),
					upgrades: [],
				}},
				gainMult() {
					return globalEffect(this.symbol).times(globalUpgEffect(this.symbol)).times(globalBuyableEffect(this.symbol));
				},
			}
			
			if (r>1) layerInfo.branches = [Object.keys(ROW_LAYERS[r-1])[l-1] || Object.keys(ROW_LAYERS[r-1])[Object.keys(ROW_LAYERS[r-1]).length-1]];
			
			if (layerType=="normal") {
				let gainExpFactor = (rand+1.5)/3
				layerInfo.exponent = RNG_DATA.rowBaseExps[r].times(gainExpFactor);
			} else if (layerType=="static") {
				let reqExpFactor = (rand+1.5)/3
				layerInfo.base = layerInfo.requires.sqrt().div(5).plus(1);
				layerInfo.exponent = RNG_DATA.staticRowBaseExps[r].times(reqExpFactor);
			}
			
			layerInfo.hasEffect = (r==1?true:(!(!Math.round(rand))))
			let hasUpgrades = rand<=0.7
			let hasBuyables = rand>=0.3
			layerInfo.overallFactor = 1/layersInRow
			layerInfo.nonEffectFactor = (hasUpgrades||hasBuyables)?((rand+1)/(layerInfo.type=="static"?5:3)):0
			
			if (layerInfo.hasEffect) {
				layerInfo.effectTarget = (r==1?"NONE":layersForEffects[r-1][Math.floor(rand*layersForEffects[r-1].length)])
				layerInfo.effect = function(){ 
					let l = this.layer;
					let et = this.effectTarget;
					let exp;
					if (et == "NONE") exp = new Decimal(1);
					else exp = tmp[et].exponent;
					if (tmp[l] === undefined) return new Decimal(1);
					let eff = new Decimal(player[l].points||0).max(0.5).plus(1)
					if (tmp[l].type=="static") eff = Decimal.pow(tmp[l].base, eff.sub(1)).pow(tmp[l].exponent);
					else eff = eff.root(tmp[l].exponent);
					
					if (et!="NONE" ? tmp[et].type=="static" : false) eff = eff.pow(RNG_DATA.rowLayerTotalMultExps[tmp[l].row].times(1-this.nonEffectFactor).times(layerInfo.overallFactor));
					else eff = eff.pow(exp).pow(RNG_DATA.rowLayerTotalMultExps[tmp[l].row].times(1-this.nonEffectFactor).times(layerInfo.overallFactor));
					return eff
				};
				layerInfo.effectDescription = function() {
					let tg = this.effectTarget;
					if (tg=="NONE") tg = "point";
					else {
						tg = tg+" point"
						if (tmp[this.effectTarget].type=="static") return "which divide the "+tg+" requirement by "+format(tmp[this.layer].effect);
					}
					return "which multiply "+tg+" gain by "+format(tmp[this.layer].effect);
				};
			}
			
			if (hasUpgrades) {
				let uLeft = layerInfo.nonEffectFactor/(hasBuyables?2:1);
				layerInfo.upgrades = {
					rows: Math.floor(random(rand*seed)*Math.min(layerInfo.row+1, 4)+1),
					cols: Math.floor(random((1-rand)*seed)*Math.min(layerInfo.row+1, 4)+1),
				}
				for (let upgRow=1;upgRow<=layerInfo.upgrades.rows;upgRow++) {
					for (let upgCol=1;upgCol<=layerInfo.upgrades.cols;upgCol++) {
						let upgRand = random(seed*upgRow*upgCol);
						let id = upgRow*10+upgCol;
						let et = (r==1?"NONE":layersForEffects[r-1][Math.floor((1-upgRand)*layersForEffects[r-1].length)]);
						let sourceID = Math.round(upgRand*r);
						let sourceName = (sourceID==0?"NONE":layersForEffects[sourceID][Math.floor(upgRand*layersForEffects[sourceID].length)]);
						let isFinal = (upgRow == layerInfo.upgrades.rows) && (upgCol == layerInfo.upgrades.cols);
						let internalUpgFactor = isFinal?uLeft:(upgRand/(layerInfo.upgrades.rows*layerInfo.upgrades.cols));
						layerInfo.upgrades[id] = {
							unlocked() { return player[this.layer].unlocked },
							et: et,
							sourceName: sourceName,
							iuf: internalUpgFactor*layerInfo.overallFactor,
							layer: layerInfo.name,
							title: layerInfo.name+String(id),
							description() { return ((et!="NONE"?tmp[et].type=="static":false)?("Divide "+(et=="NONE"?"point":(et+" point"))+" requirement"):("Multiply "+(et=="NONE"?"point":(et+" point"))+" gain"))+" based on "+(sourceName=="NONE"?"points":(sourceName+" points"))},
							cost: (r>1&&id==11&&!layerInfo.hasEffect)?new Decimal(1):(Decimal.mul(Decimal.pow(1.4, Decimal.pow((upgRow-1)*layerInfo.upgrades.cols+upgCol, 2)), 2-upgRand).round()),
							effect() { 
								let exp;
								if (this.et == "NONE") exp = new Decimal(1);
								else exp = tmp[this.et].exponent;
								let amt;
								if (this.sourceName == "NONE") amt = player.points;
								else amt = player[this.sourceName].points;
								eff = new Decimal(amt||0).max(0.5).plus(1)
								if (this.sourceName!="NONE" ? tmp[this.sourceName].type=="static" : false) eff = Decimal.pow(tmp[this.sourceName].base, eff).pow(tmp[this.sourceName].exponent).pow(exp).pow(RNG_DATA.rowLayerTotalMultExps[tmp[this.layer].row].times(this.iuf))
								else eff = eff.root((this.sourceName=="NONE")?1:tmp[this.sourceName].exponent).pow(exp).pow(RNG_DATA.rowLayerTotalMultExps[tmp[this.layer].row].times(this.iuf)) 
								return eff;
							},
							effectDisplay() { return format(tmp[this.layer].upgrades[this.id].effect)+"x" },
						}
						uLeft = Math.max(uLeft-internalUpgFactor, 0);
					}
				}
			}
			
			if (hasBuyables) {
				let uLeft = layerInfo.nonEffectFactor/(hasUpgrades?2:1);
				layerInfo.buyables = {
					rows: Math.floor(random(rand*Math.pow(seed, 2))*Math.min(layerInfo.row+1, 3)+1),
					cols: Math.floor(random((1-rand)*Math.pow(seed, 2))*Math.min(layerInfo.row+1, 3)+1),
				}
				for (let bRow=1;bRow<=layerInfo.buyables.rows;bRow++) {
					for (let bCol=1;bCol<=layerInfo.buyables.cols;bCol++) {
						let bblRand = random(Math.sqrt(seed)*bRow*bCol)
						let id = bRow*10+bCol;
						let et = (r==1?"NONE":layersForEffects[r-1][Math.floor((1-bblRand)*layersForEffects[r-1].length)]);
						let isFinal = (bRow == layerInfo.buyables.rows) && (bCol == layerInfo.buyables.cols);
						let internalBblFactor = isFinal?uLeft:(bblRand/(layerInfo.buyables.rows*layerInfo.buyables.cols));
						layerInfo.buyables[id] = {
							et: et,
							iuf: internalBblFactor*layerInfo.overallFactor,
							layer: layerInfo.name,
							title: layerInfo.name+String(id)+"b",
							unlocked() { return player[this.layer].unlocked }, 
							canAfford() { return player[this.layer].points.gte(tmp[this.layer].buyables[this.id].cost) },
							buy() { 
								cost = tmp[this.layer].buyables[this.id].cost
								player[this.layer].points = player[this.layer].points.sub(cost)	
								player[this.layer].buyables[this.id] = player[this.layer].buyables[this.id].add(1)
								player[this.layer].spentOnBuyables = player[this.layer].spentOnBuyables.add(cost) 
							},
							costStart: (r>1&&id==11&&!hasUpgrades&&!layerInfo.hasEffect)?new Decimal(1):(Decimal.pow(2*(1-internalBblFactor)+1, (bRow-1)*layerInfo.buyables.cols+bCol).div(hasUpgrades?1:2)),
							costBase: Decimal.pow(5, ((2-bblRand)/3)*internalBblFactor),
							effDesc() {
								let stat = (et=="NONE")?false:tmp[et].type=="static";
								return (stat?("Divides "+(et=="NONE"?"point":(et+" point"))+" requirement"):("Multiplies "+(et=="NONE"?"point":(et+" point"))+" gain"))+" by "+format(tmp[this.layer].buyables[this.id].effect);
							},
							display() {
								let data = tmp[this.layer].buyables[this.id];
								return "Cost: "+formatWhole(data.cost)+" "+tmp[this.layer].symbol+" points\n\
								Amount: "+formatWhole(player[this.layer].buyables[this.id])+"\n"+data.effDesc
							},
							cost(x=player[this.layer].buyables[this.id]) {
								let data = tmp[this.layer].buyables[this.id];
								let costStart = this.costStart;
								let costBase = this.costBase;
								return Decimal.pow(costBase, x).times(costStart).round();
							},
							effect() { 
								let exp;
								if (this.et == "NONE") exp = new Decimal(1);
								else exp = tmp[this.et].exponent;
								let bought = player[this.layer].buyables[this.id];
								eff = layers[this.layer].buyables[this.id].cost(bought.sub(1)).times(bought.gte(1)?bought.min(5):0).plus(bought.gte(1)?0:1).root(tmp[this.layer].exponent).pow(exp).pow(RNG_DATA.rowLayerTotalMultExps[tmp[this.layer].row].times(this.iuf))
								return eff;
							},
						}
						uLeft = Math.max(uLeft-internalBblFactor, 0);
					}
				}
			}
			
			addLayer(layerName, layerInfo)
		}
	}
}

createLayers();