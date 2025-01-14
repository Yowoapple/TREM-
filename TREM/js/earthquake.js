/* eslint-disable no-inner-declarations */
/* eslint-disable no-undef */
const { BrowserWindow, shell } = require("@electron/remote");
const path = require("path");

$("#loading").text({ en: "Loading...", ja: "ローディング中...", "zh-TW": "載入中..." }[CONFIG["general.locale"]]);
document.title = { en: "Taiwan Real-time Earthquake Monitoring", ja: "TREM 台湾リアルタイム地震モニタリング", "zh-TW": "TREM 臺灣即時地震監測" }[CONFIG["general.locale"]];

// #region 變數
let Stamp = 0;
let t = null;
let UserLocationLat = 25.0421407;
let UserLocationLon = 121.5198716;
let All = [];
const arrive = [];
let audioList = [];
let audioList1 = [];
let audioLock = false;
let audioLock1 = false;
const ReportCache = {};
let ReportMarkID = null;
const MarkList = [];
const EarthquakeList = {};
let marker = null;
let map, mapTW;
let mapLayer, mapLayerTW;
let MainLock = false;
const Station = {};
const PGA = {};
const pga = {};
let RMT = 1;
let RMTlimit = [];
let PGALimit = 0;
let PGAaudio = false;
let PGAtag = 0;
let MAXPGA = { pga: 0, station: "NA", level: 0 };
let expected = [];
const Info = { Notify: [], Warn: [], Focus: [] };
const Focus = [];
let PGAmark = false;
let INFO = [];
let TINFO = 0;
let ticker = null;
let ITimer = null;
const Tsunami = {};
let Report = 0;
let Sspeed = 4;
let Pspeed = 7;
const Server = [];
let PAlert = {};
let Location;
let station = {};
let PGAjson = {};
let PalertT = 0;
let MainClock = null;
let geojson = null;
let Pgeojson = null;
let mapTW_geoJson, map_geoJson;
let clickT = 0;
let investigation = false;
let ReportTag = 0;
let EEWshot = 0;
let EEWshotC = 0;
let Response = {};
let replay = 0;
let replayT = 0;
let Second = -1;
let mapLock = false;
let PAlertT = 0;
let auto = false;
const EEW = {};
const EEWT = { id: 0, time: 0 };
let TSUNAMI = {};
// #endregion

// #region override Date.format()
Date.prototype.format =
	/**
	 * Format DateTime into string with provided formatting string.
	 * @param {string} format The formatting string to use.
	 * @returns {string} The formatted string.
	 */
	function(format) {
		/**
		 * @type {Date}
		 */
		const me = this;
		return format.replace(/a|A|Z|S(SS)?|ss?|mm?|HH?|hh?|D{1,2}|M{1,2}|YY(YY)?|'([^']|'')*'/g, (str) => {
			let c1 = str.charAt(0);
			const ret = str.charAt(0) == "'"
				? (c1 = 0) || str.slice(1, -1).replace(/''/g, "'")
				: str == "a"
					? (me.getHours() < 12 ? "am" : "pm")
					: str == "A"
						? (me.getHours() < 12 ? "AM" : "PM")
						: str == "Z"
							? (("+" + -me.getTimezoneOffset() / 60).replace(/^\D?(\D)/, "$1").replace(/^(.)(.)$/, "$10$2") + "00")
							: c1 == "S"
								? me.getMilliseconds()
								: c1 == "s"
									? me.getSeconds()
									: c1 == "H"
										? me.getHours()
										: c1 == "h"
											? (me.getHours() % 12) || 12
											: c1 == "D"
												? me.getDate()
												: c1 == "m"
													? me.getMinutes()
													: c1 == "M"
														? me.getMonth() + 1
														: ("" + me.getFullYear()).slice(-str.length);
			return c1 && str.length < 4 && ("" + ret).length < str.length
				? ("00" + ret).slice(-str.length)
				: ret;
		});
	};
// #endregion

// #region 初始化
const win = BrowserWindow.fromId(process.env.window * 1);
const roll = document.getElementById("rolllist");
win.setAlwaysOnTop(false);
win.on("show", () => {
	focus();
});

let TimeDesynced = false;
async function init() {
	ReportGET({});
	const time = document.getElementById("time");

	// clock
	setInterval(() => {
		if (TimeDesynced)
			time.classList.add("desynced");
		else {
			if (time.classList.contains("desynced"))
				time.classList.remove("desynced");
			if (replay == 0) {
				if (time.classList.contains("replay"))
					time.classList.remove("replay");
				time.innerText = NOW.format("YYYY/MM/DD HH:mm:ss");
			} else {
				if (!time.classList.contains("replay"))
					time.classList.add("replay");
				time.innerText = new Date(replay + (NOW.getTime() - replayT)).format("YYYY/MM/DD HH:mm:ss");
			}
		}
	}, 500);

	setInterval(() => {
		if (Object.keys(Tsunami).length != 0)
			if (NOW.getTime() - Tsunami.Time > 240000) {
				map.removeLayer(Tsunami.Cross);
				delete Tsunami.Cross;
				delete Tsunami.Time;
				focus([23.608428, 120.799168], 7.5);
			}

		if (investigation && NOW.getTime() - Report > 600000) {
			investigation = false;
			roll.removeChild(roll.children[0]);
			if (Pgeojson != null) {
				map.removeLayer(Pgeojson);
				Pgeojson = null;
			}
		}
		if (ReportTag != 0 && NOW.getTime() - ReportTag > 30000) {
			ReportTag = 0;
			if (ReportMarkID != null) {
				ReportMarkID = null;
				for (let index = 0; index < MarkList.length; index++)
					map.removeLayer(MarkList[index]);
				focus([23.608428, 120.799168], 7.5);
			}
		}
	}, 200);

	map = L.map("map", {
		attributionControl : false,
		closePopupOnClick  : false,
		maxBounds          : [
			[60, 50],
			[10, 180],
		],
		preferCanvas: true,
	}).setView([23, 121], 7.5);

	mapTW = L.map("map-tw", {
		attributionControl : false,
		closePopupOnClick  : false,
		preferCanvas       : true,
	}).setView([23.608428, 120.799168], 7);

	mapTW.on("zoom", () => {
		mapTW.setView([23.608428, 120.799168], 7);
	});

	mapTW.dragging.disable();
	mapTW.scrollWheelZoom.disable();
	mapTW.doubleClickZoom.disable();
	map.doubleClickZoom.disable();
	mapTW.removeControl(mapTW.zoomControl);

	setUserLocationMarker(CONFIG["location.city"], CONFIG["location.town"]);
	const colors = await getThemeColors(CONFIG["theme.color"], CONFIG["theme.dark"]);
	/*
	mapTW_geoJson = L.geoJson.vt(Dmap, {
		style: {
			weight    : 0.8,
			opacity   : 0.3,
			color     : colors.primary,
			fillColor : colors.surfaceVariant,
		},
	}).addTo(mapTW);
*/
	map_geoJson = L.geoJson.vt(Dmap, {
		minZoom   : 4,
		maxZoom   : 12,
		tolerance : 0.5,
		buffer    : 256,
		debug     : 0,
		style     : {
			weight    : 0.8,
			color     : colors.primary,
			fillColor : colors.surfaceVariant,
		},
	}).addTo(map);

	map.on("click", (e) => {
		if (ReportMarkID != null) {
			ReportMarkID = null;
			for (let index = 0; index < MarkList.length; index++)
				map.removeLayer(MarkList[index]);
		}
		mapLock = false;
		focus();
	});

	map.on("dblclick", (e) => {
		focus();
	});

	map.on("drag", (e) => {
		mapLock = true;
	});

	map.on("dblclick", (e) => {
		focus([23.608428, 120.799168], 7.5);
	});

	map.removeControl(map.zoomControl);

	setTimeout(() => {main();}, 1500);

	setInterval(() => {
		main();
	}, 300000);

	function main() {
		fetch("https://raw.githubusercontent.com/ExpTechTW/TW-EEW/%E4%B8%BB%E8%A6%81%E7%9A%84-(main)/locations.json")
			.then((response) => response.json())
			.then((res) => {
				Location = res;
				fetch("https://raw.githubusercontent.com/ExpTechTW/API/master/Json/earthquake/station.json")
					.then((response) => response.json())
					.then((res1) => {
						station = res1;
						dump({ level: 0, message: "Get Station File", origin: "Location" });
						fetch("https://raw.githubusercontent.com/ExpTechTW/API/master/Json/earthquake/pga.json")
							.then((response) => response.json())
							.then((res2) => {
								PGAjson = res2;
								dump({ level: 0, message: "Get PGA Location File", origin: "Location" });
								if (CONFIG["earthquake.Real-time"])
									PGAMain();
							});
					});
			});
	}

	function PGAMain() {
		dump({ level: 0, message: "Start PGA Timer", origin: "PGATimer" });
		if (MainClock != null) clearInterval(MainClock);
		MainClock = setInterval(() => {
			if (MainLock) return;
			MainLock = true;
			let R = 0;
			if (replay != 0) R = replay + (NOW.getTime() - replayT);
			const data = {
				"APIkey"   : "https://github.com/ExpTechTW",
				"Function" : "data",
				"Type"     : "TREM",
				"Value"    : R,
			};
			const CancelToken = axios.CancelToken;
			let cancel;
			setTimeout(() => {
				cancel();
			}, 3000);
			axios({
				method      : "post",
				url         : PostIP(),
				data        : data,
				cancelToken : new CancelToken((c) => {
					cancel = c;
				}),
			}).then((response) => {
				Response = response.data;
				handler(Response);
			}).catch((err) => {
				handler(Response);
			});
		}, 1000);
	}

	function handler(response) {
		/*
			for (let index = 0; index < Object.keys(Station).length; index++) {
				map.removeLayer(Station[Object.keys(Station)[index]]);
				delete Station[Object.keys(Station)[index]];
				index--;
			}
			*/
		if (response.state != "Success") return;

		const Json = response.response;
		MAXPGA = { pga: 0, station: "NA", level: 0 };

		for (let index = 0; index < Object.keys(Json).length; index++) {
			const Sdata = Json[Object.keys(Json)[index]];
			const amount = Number(Sdata.MaxPGA);
			if (station[Object.keys(Json)[index]] == undefined) continue;

			const Intensity = (NOW.getTime() - Sdata.TimeStamp > 5000) ? "NA" :
				(amount >= 800) ? 9 :
					(amount >= 440) ? 8 :
						(amount >= 250) ? 7 :
							(amount >= 140) ? 6 :
								(amount >= 80) ? 5 :
									(amount >= 25) ? 4 :
										(amount >= 8) ? 3 :
											(amount >= 5) ? 2 :
												(amount >= 3) ? 1 :
													0;

			const size = (Intensity == 0) ? 10 : 15;
			const Image = (Intensity) ? `./image/${Intensity}.png` :
				(amount > 3.5) ? "./image/0-5.png" :
					(amount > 3) ? "./image/0-4.png" :
						(amount > 2.8) ? "./image/0-3.png" :
							(amount > 2.5) ? "./image/0-2.png" :
								"./image/0-1.png";

			const stationIcon = L.icon({
				iconUrl  : Image,
				iconSize : [size, size],
			});

			if (!Station[Object.keys(Json)[index]])
				Station[Object.keys(Json)[index]] = L.marker([station[Object.keys(Json)[index]].Lat, station[Object.keys(Json)[index]].Long], { keyboard: false })
					.addTo(map);
			Station[Object.keys(Json)[index]]
				.setIcon(stationIcon)
				.setZIndexOffset(2000 + amount);

			const Level = IntensityI(Intensity);
			const now = new Date(Sdata.Time);
			if (Object.keys(Json)[index] == CONFIG["Real-time.station"]) {
				document.getElementById("rt-station-name").innerText = station[Object.keys(Json)[index]].Loc;
				document.getElementById("rt-station-time").innerText = now.format("MM/DD HH:mm:ss");
				document.getElementById("rt-station-intensity").innerText = IntensityI(Intensity);
				document.getElementById("rt-station-pga").innerText = amount;
			}
			if (pga[station[Object.keys(Json)[index]].PGA] == undefined && Intensity != "NA")
				pga[station[Object.keys(Json)[index]].PGA] = {
					"Intensity" : Intensity,
					"Time"      : 0,
				};
			if (Intensity != "NA" && Intensity != 0) {
				if (Intensity > pga[station[Object.keys(Json)[index]].PGA].Intensity) pga[station[Object.keys(Json)[index]].PGA].Intensity = Intensity;
				if (Sdata.Alert || fs.existsSync(path.join(app.getPath("userData"), "./unlockAlert.tmp"))) {
					let find = -1;
					for (let Index = 0; Index < All.length; Index++)
						if (All[Index].loc == station[Object.keys(Json)[index]].Loc) {
							All[Index].intensity = Intensity;
							All[Index].time = NOW.getTime();
							All[Index].pga = amount;
							find = 0;
							break;
						}
					if (find == -1)
						All.push({
							"loc"       : station[Object.keys(Json)[index]].Loc,
							"intensity" : Intensity,
							"time"      : NOW.getTime(),
							"pga"       : amount,
						});
					if (CONFIG["earthquake.Real-time-forecast"])
						limit();
					else
					if (RMTlimit.length < 2) {
						if (!RMTlimit.includes(Object.keys(Json)[index])) RMTlimit.push(Object.keys(Json)[index]);
					} else
						limit();

					function limit() {
						if (amount > 8 && PGALimit == 0) {
							PGALimit = 1;
							audioPlay("./audio/PGA1.wav");
						} else if (amount > 250 && PGALimit != 2) {
							PGALimit = 2;
							audioPlay("./audio/PGA2.wav");
						}
						pga[station[Object.keys(Json)[index]].PGA].Time = NOW.getTime();
					}
				}
				if (MAXPGA.pga < amount && Level != "NA") {
					MAXPGA.pga = amount;
					MAXPGA.station = Object.keys(Json)[index];
					MAXPGA.level = Level;
					MAXPGA.lat = station[Object.keys(Json)[index]].Lat;
					MAXPGA.long = station[Object.keys(Json)[index]].Long;
					MAXPGA.loc = station[Object.keys(Json)[index]].Loc;
					MAXPGA.intensity = Intensity;
					MAXPGA.ms = NOW.getTime() - Sdata.TimeStamp;
				}
			}
		}
		if (PAlert.data != undefined)
			if (PAlert.timestamp != PAlertT) {
				PAlertT = PAlert.timestamp;
				const PLoc = {};
				let MaxI = 0;
				for (let index = 0; index < PAlert.data.length; index++) {
					PLoc[PAlert.data[index].loc] = PAlert.data[index].intensity;
					if (PAlert.data[index].intensity > MaxI) {
						MaxI = PAlert.data[index].intensity;
						Report = NOW.getTime();
						ReportGET({
							Max  : MaxI,
							Time : NOW.format("YYYY/MM/DD HH:mm:ss"),
						});
					}
				}
				if (PalertT != PAlert.timestamp && Object.keys(PLoc).length != 0) {
					PalertT = PAlert.timestamp;
					if (Pgeojson == null) {
						if (CONFIG["Real-time.show"])
							win.show();
						if (CONFIG["Real-time.cover"]) win.setAlwaysOnTop(true);
						win.setAlwaysOnTop(false);
						audioPlay("./audio/palert.wav");
					}
					if (Pgeojson != null) map.removeLayer(Pgeojson);
					Pgeojson = L.geoJson(DmapT, {
						style: (feature) => {
							if (feature.properties.COUNTY != undefined) {
								const name = feature.properties.COUNTY + " " + feature.properties.TOWN;
								if (PLoc[name] == 0 || PLoc[name] == undefined)
									return {
										weight      : 0,
										opacity     : 0,
										color       : "#8E8E8E",
										dashArray   : "",
										fillOpacity : 0,
										fillColor   : "transparent",
									};
								return {
									weight      : 0,
									opacity     : 0,
									color       : "#8E8E8E",
									dashArray   : "",
									fillOpacity : 0.8,
									fillColor   : color(PLoc[name]),
								};
							} else
								return {
									weight      : 0,
									opacity     : 0,
									color       : "#8E8E8E",
									dashArray   : "",
									fillOpacity : 0,
									fillColor   : "transparent",
								};
						},
					});
					map.addLayer(Pgeojson);
					setTimeout(() => {
						ipcRenderer.send("screenshotEEW", {
							"ID"      : NOW.getTime(),
							"Version" : "P",
						});
					}, 1250);
				}
			}
		for (let index = 0; index < Object.keys(PGA).length; index++) {
			if (RMT == 0) map.removeLayer(PGA[Object.keys(PGA)[index]]);
			delete PGA[Object.keys(PGA)[index]];
			index--;
		}
		RMT++;
		for (let index = 0; index < Object.keys(pga).length; index++) {
			const Intensity = pga[Object.keys(pga)[index]].Intensity;
			if (NOW.getTime() - pga[Object.keys(pga)[index]].Time > 30000) {
				delete pga[Object.keys(pga)[index]];
				index--;
			} else {
				PGA[Object.keys(pga)[index]] = L.polygon(PGAjson[Object.keys(pga)[index].toString()], {
					color     : color(Intensity),
					fillColor : "transparent",
				});
				if (RMT >= 2) map.addLayer(PGA[Object.keys(pga)[index]]);
				PGAaudio = true;
			}
		}
		if (RMT >= 2) RMT = 0;
		if (Object.keys(pga).length != 0 && !PGAmark)
			PGAmark = true;
		if (PGAmark && Object.keys(pga).length == 0) {
			PGAmark = false;
			RMT = 1;
			RMTlimit = [];
			All = [];
		}
		if (Object.keys(PGA).length == 0) PGAaudio = false;
		if (!PGAaudio) {
			PGAtag = 0;
			PGALimit = 0;
		}
		for (let Index = 0; Index < All.length - 1; Index++)
			for (let index = 0; index < All.length - 1; index++)
				if (All[index].amount < All[index + 1].amount) {
					const Temp = All[index + 1];
					All[index + 1] = All[index];
					All[index] = Temp;
				}
		if (All.length != 0 && All[0].intensity > PGAtag && Object.keys(pga).length != 0) {
			if (CONFIG["Real-time.audio"])
				if (All[0].intensity >= 5 && PGAtag < 5)
					audioPlay("./audio/Shindo2.wav");
				else if (All[0].intensity >= 2 && PGAtag < 2)
					audioPlay("./audio/Shindo1.wav");
				else if (PGAtag == 0)
					audioPlay("./audio/Shindo0.wav");

			if (All[0].intensity >= 2) {
				setTimeout(() => {
					ipcRenderer.send("screenshotEEW", {
						"ID"      : NOW.getTime(),
						"Version" : "P",
					});
				}, 500);
				if (CONFIG["Real-time.show"])
					win.show();
				if (CONFIG["Real-time.cover"]) win.setAlwaysOnTop(true);
				win.setAlwaysOnTop(false);
			}
			PGAtag = All[0].intensity;
		}
		const list = [];
		let count = 0;
		for (let Index = 0; Index < All.length; Index++, count++) {
			if (!PGAaudio || count >= 10) break;
			if (NOW.getTime() - All[Index].time > 30000) continue;
			const container = document.createElement("DIV");
			container.className = IntensityToClassString(All[Index].intensity);
			const location = document.createElement("span");
			location.innerText = All[Index].loc;
			container.appendChild(document.createElement("span"));
			container.appendChild(location);
			list.push(container);
		}
		document.getElementById("rt-list").replaceChildren(...list);
		MainLock = false;
	}
	$("#app-version").text(app.getVersion());
	$("#loading").text({ en: "Welcome", ja: "ようこそ", "zh-TW": "歡迎" }[CONFIG["general.locale"]]);
	$("#load").delay(1000).fadeOut(1000);
	setInterval(() => {
		if (mapLock) return;
		if (Object.keys(EEW).length != 0) {
			for (let index = 0; index < Object.keys(EEW).length; index++)
				if (EEWT.id == 0 || EEWT.id == EEW[Object.keys(EEW)[index]].id || NOW.getTime() - EEW[Object.keys(EEW)[index]].time >= 10000) {
					EEWT.id = EEW[Object.keys(EEW)[index]].id;
					let Zoom = 9;
					const X = 0;
					const km = (NOW.getTime() - EEW[Object.keys(EEW)[index]].Time) * 4;
					if (km > 100000)
						Zoom = 8;
					if (km > 150000)
						Zoom = 7.5;
					if (km > 200000)
						Zoom = 7;
					if (km > 250000)
						Zoom = 6.5;
					if (km > 300000)
						Zoom = 6;

					const num = Math.sqrt(Math.pow(23.608428 - EEW[Object.keys(EEW)[index]].lat, 2) + Math.pow(120.799168 - EEW[Object.keys(EEW)[index]].lon, 2));
					if (num >= 5)
						focus([EEW[Object.keys(EEW)[index]].lat, EEW[Object.keys(EEW)[index]].lon], Zoom);
					else
						focus([(23.608428 + EEW[Object.keys(EEW)[index]].lat) / 2, ((120.799168 + EEW[Object.keys(EEW)[index]].lon) / 2) + X], Zoom);
					EEW[Object.keys(EEW)[index]].time = NOW.getTime();
				}
			auto = true;
		} else if (Object.keys(PGA).length >= 1) {
			if (Object.keys(PGA).length == 1) {
				const X1 = (PGAjson[Object.keys(pga)[0].toString()][0][0] + (PGAjson[Object.keys(pga)[0].toString()][2][0] - PGAjson[Object.keys(pga)[0].toString()][0][0]) / 2);
				const Y1 = (PGAjson[Object.keys(pga)[0].toString()][0][1] + (PGAjson[Object.keys(pga)[0].toString()][1][1] - PGAjson[Object.keys(pga)[0].toString()][0][1]) / 2);
				focus([X1, Y1], 9.5);
			} else if (Object.keys(PGA).length >= 2) {
				const X1 = (PGAjson[Object.keys(pga)[0].toString()][0][0] + (PGAjson[Object.keys(pga)[0].toString()][2][0] - PGAjson[Object.keys(pga)[0].toString()][0][0]) / 2);
				const Y1 = (PGAjson[Object.keys(pga)[0].toString()][0][1] + (PGAjson[Object.keys(pga)[0].toString()][1][1] - PGAjson[Object.keys(pga)[0].toString()][0][1]) / 2);
				const X2 = (PGAjson[Object.keys(pga)[1].toString()][0][0] + (PGAjson[Object.keys(pga)[1].toString()][2][0] - PGAjson[Object.keys(pga)[1].toString()][0][0]) / 2);
				const Y2 = (PGAjson[Object.keys(pga)[1].toString()][0][1] + (PGAjson[Object.keys(pga)[1].toString()][1][1] - PGAjson[Object.keys(pga)[1].toString()][0][1]) / 2);
				let Zoom = 9;
				if (Object.keys(PGA).length == 2) {
					const num = Math.sqrt(Math.pow(X1 - X2, 2) + Math.pow(Y1 - Y2, 2));
					if (num > 0.6) Zoom = 9;
					if (num > 1) Zoom = 8.5;
					if (num > 1.5) Zoom = 8;
					if (num > 2.8) Zoom = 7;
				} else {
					if (Object.keys(PGA).length >= 4) Zoom = 8;
					if (Object.keys(PGA).length >= 6) Zoom = 7.5;
					if (Object.keys(PGA).length >= 8) Zoom = 7;
				}
				focus([(X1 + X2) / 2, (Y1 + Y2) / 2], Zoom);
			}
			auto = true;
		} else
		if (auto) {
			auto = false;
			focus([23.608428, 120.799168], 7.5);
		}
	}, 500);
}
// #endregion

// #region 用戶所在位置
async function setUserLocationMarker(city, town) {
	if (!Location) {
		Location = await (await fetch("https://raw.githubusercontent.com/ExpTechTW/TW-EEW/master/locations.json")).json();
		dump({ level: 0, message: "Get Location File", origin: "Location" });
	}

	[, UserLocationLat, UserLocationLon] = Location[city][town];

	if (!marker) {
		const icon = L.icon({
			iconUrl  : "./image/here.png",
			iconSize : [20, 20],
		});
		marker = L.marker([UserLocationLat, UserLocationLon], { icon: icon })
			.setZIndexOffset(1)
			.addTo(map);
	} else marker.setLatLng([UserLocationLat, UserLocationLon]);
	dump({ level: 0, message: `User location set to ${city} ${town} (${UserLocationLat}, ${UserLocationLat})`, origin: "Location" });
	focus([23.608428, 120.799168], 7.5);
}
// #endregion

// #region 聚焦
function focus(Loc, size) {
	if (!CONFIG["map.autoZoom"]) return;
	let X = 0;
	if (size >= 6) X = 2.5;
	if (size >= 6.5) X = 1.6;
	if (size >= 7) X = 1.5;
	if (size >= 7.5) X = 0.9;
	if (size >= 8) X = 0.6;
	if (size >= 8.5) X = 0.4;
	if (size >= 9) X = 0.35;
	if (size >= 9.5) X = 0.2;
	if (Loc != undefined) {
		Focus[0] = Loc[0];
		Focus[1] = Loc[1] + X;
		Focus[2] = size;
		if (map.getBounds().getCenter().lat.toFixed(2) != Loc[0].toFixed(2) || map.getBounds().getCenter().lng.toFixed(2) != (Loc[1] + X).toFixed(2) || size != map.getZoom())
			map.setView([Loc[0], Loc[1] + X], size);
	} else if (Focus.length != 0)
		if (map.getBounds().getCenter().lat.toFixed(2) != Focus[0].toFixed(2) || map.getBounds().getCenter().lng.toFixed(2) != Focus[1].toFixed(2) || Focus[2] != map.getZoom())
			map.setView([Focus[0], Focus[1]], Focus[2]);
}
// #endregion

// #region 音頻播放
let AudioT;
let AudioT1;
const audioDOM = new Audio();
const audioDOM1 = new Audio();
audioDOM.addEventListener("ended", () => {
	audioLock = false;
});
audioDOM1.addEventListener("ended", () => {
	audioLock1 = false;
});

function audioPlay(src) {
	audioList.push(src);
	if (!AudioT)
		AudioT = setInterval(() => {
			if (!audioLock) {
				audioLock = true;
				if (audioList.length)
					playNextAudio();
				else {
					clearInterval(AudioT);
					audioLock = false;
					AudioT = null;
				}
			}
		}, 0);
}
function audioPlay1(src) {
	audioList1.push(src);
	if (!AudioT1)
		AudioT1 = setInterval(() => {
			if (!audioLock1) {
				audioLock1 = true;
				if (audioList1.length)
					playNextAudio1();
				else {
					clearInterval(AudioT1);
					audioLock1 = false;
					AudioT1 = null;
				}
			}
		}, 0);
}
function playNextAudio() {
	audioLock = true;
	const path = audioList.shift();
	audioDOM.src = path;
	if (path.startsWith("./audio/1/") && CONFIG["eew.audio"]) {
		dump({ level: 0, message: `Playing Audio > ${path}`, origin: "Audio" });
		audioDOM.play();
	} else if (!path.startsWith("./audio/1/")) {
		dump({ level: 0, message: `Playing Audio > ${path}`, origin: "Audio" });
		audioDOM.play();
	}
}
function playNextAudio1() {
	audioLock1 = true;
	const path = audioList1.shift();
	audioDOM1.src = path;
	if (path.startsWith("./audio/1/") && CONFIG["eew.audio"]) {
		dump({ level: 0, message: `Playing Audio > ${path}`, origin: "Audio" });
		audioDOM1.play();
	} else if (!path.startsWith("./audio/1/")) {
		dump({ level: 0, message: `Playing Audio > ${path}`, origin: "Audio" });
		audioDOM1.play();
	}
}
// #endregion

// #region Report Data
async function ReportGET(eew) {
	const res = await getReportByData();
	dump({ level: 0, message: "Reports fetched", origin: "EQReportFetcher" });
	if (res["state"] == "Warn") {
		dump({ level: 2, message: res, origin: "EQReportFetcher" });
		console.error(res);
		setTimeout(() => {
			ReportGET();
		}, 2000);
	} else
		ReportList(res, eew);
}
async function getReportByData() {
	try {
		const list = await axios.post(PostIP(), {
			"APIkey"   : "https://github.com/ExpTechTW",
			"Function" : "data",
			"Type"     : "earthquake",
			"Value"    : 100,
		});
		return list.data;
	} catch (error) {
		dump({ level: 2, message: error, origin: "EQReportFetcher" });
		console.error(error);
	}

}
// #endregion

// #region Report 點擊
// eslint-disable-next-line no-shadow
async function ReportClick(time) {
	if (ReportMarkID == time) {
		ReportMarkID = null;
		for (let index = 0; index < MarkList.length; index++)
			map.removeLayer(MarkList[index]);
		focus([23.608428, 120.799168], 7.5);
	} else {
		ReportMarkID = time;
		for (let index = 0; index < MarkList.length; index++)
			map.removeLayer(MarkList[index]);

		const LIST = [];
		const body = {
			"APIkey"   : "https://github.com/ExpTechTW",
			"Function" : "data",
			"Type"     : "report",
			"Value"    : ReportCache[time].earthquakeNo,
		};
		if (
			// 確認是否為無編號地震
			ReportCache[time].earthquakeNo % 1000 == 0
			|| await axios.post(PostIP(), body)
				.then((response) => {
					const json = response.data.response;
					if (json == undefined)
						return true;
					else {
						for (let Index = 0; Index < json.Intensity.length; Index++)
							for (let index = 0; index < json.Intensity[Index].station.length; index++) {
								// eslint-disable-next-line no-shadow
								const Station = json.Intensity[Index].station[index];
								let Intensity = Station.stationIntensity.$t;
								if (Station.stationIntensity.unit == "強") Intensity += "+";
								if (Station.stationIntensity.unit == "弱") Intensity += "-";
								const myIcon = L.icon({
									iconUrl  : `./image/${IntensityI(Intensity)}.png`,
									iconSize : [20, 20],
								});
								const ReportMark = L.marker([Station.stationLat.$t, Station.stationLon.$t], { icon: myIcon });
								// eslint-disable-next-line no-shadow
								let PGA = "";
								if (Station.pga != undefined) PGA = `<br>PGA<br>垂直向: ${Station.pga.vComponent}<br>東西向: ${Station.pga.ewComponent}<br>南北向: ${Station.pga.nsComponent}<br><a onclick="openURL('${Station.waveImageURI}')">震波圖</a>`;
								ReportMark.bindPopup(`站名: ${Station.stationName}<br>代號: ${Station.stationCode}<br>經度: ${Station.stationLon.$t}<br>緯度: ${Station.stationLat.$t}<br>震央距: ${Station["distance"].$t}<br>方位角: ${Station["azimuth"].$t}<br>震度: ${Intensity}<br>${PGA}`);
								map.addLayer(ReportMark);
								ReportMark.setZIndexOffset(1000 + index);
								MarkList.push(ReportMark);
							}
						focus([Number(json.NorthLatitude), Number(json.EastLongitude)], 7.5);
						const myIcon = L.icon({
							iconUrl  : "./image/star.png",
							iconSize : [25, 25],
						});
						const ReportMark = L.marker([Number(json.NorthLatitude), Number(json.EastLongitude)], { icon: myIcon });
						ReportMark.bindPopup(`編號: ${json.No}<br>經度: ${json.EastLongitude}<br>緯度: ${json.NorthLatitude}<br>深度: ${json.Depth}<br>規模: ${json.Scale}<br>位置: ${json.Location}<br>時間: ${json["UTC+8"]}<br><br><a onclick="openURL('${json.Web}')">網頁</a><br><a onclick="openURL('${json.EventImage}')">地震報告</a><br><a onclick="openURL('${json.ShakeImage}')">震度分布</a>`);
						map.addLayer(ReportMark);
						ReportMark.setZIndexOffset(3000);
						MarkList.push(ReportMark);
						return false;
					}
				})
				.catch((error) => {
					console.log(error);
					return false;
				})
		) {
			for (let Index = 0; Index < ReportCache[time].data.length; Index++)
				for (let index = 0; index < ReportCache[time].data[Index]["eqStation"].length; index++) {
					const data = ReportCache[time].data[Index]["eqStation"][index];
					const myIcon = L.icon({
						iconUrl  : `./image/${data.stationIntensity}.png`,
						iconSize : [20, 20],
					});
					const level = IntensityI(data.stationIntensity);
					LIST.push({
						Lat       : Number(data.stationLat),
						Long      : Number(data.stationLon),
						Icon      : myIcon,
						Level     : level,
						Intensity : Number(data.stationIntensity),
						Name      : `${ReportCache[time].data[Index]["areaName"]} ${data["stationName"]}`,
					});
				}

			for (let Index = 0; Index < LIST.length - 1; Index++)
				for (let index = 0; index < LIST.length - 1; index++)
					if (LIST[index].Intensity > LIST[index + 1].Intensity) {
						const Temp = LIST[index];
						LIST[index] = LIST[index + 1];
						LIST[index + 1] = Temp;
					}


			for (let index = 0; index < LIST.length; index++) {
				const ReportMark = L.marker([LIST[index].Lat, LIST[index].Long], { icon: LIST[index].Icon });
				ReportMark.bindPopup(`站名: ${LIST[index].Name}<br>經度: ${LIST[index].Long}<br>緯度: ${LIST[index].Lat}<br>震度: ${LIST[index].Level}`);
				map.addLayer(ReportMark);
				ReportMark.setZIndexOffset(1000 + index);
				MarkList.push(ReportMark);
			}
			focus([Number(ReportCache[time].epicenterLat), Number(ReportCache[time].epicenterLon)], 7.5);
			const icon = L.icon({
				iconUrl  : "./image/star.png",
				iconSize : [25, 25],
			});
			const ReportMark = L.marker([Number(ReportCache[time].epicenterLat), Number(ReportCache[time].epicenterLon)], { icon });
			let Num = "無";
			if (ReportCache[time].earthquakeNo.toString().substring(3, 6) != "000") Num = ReportCache[time].earthquakeNo;
			ReportMark.bindPopup(`編號: ${Num}<br>經度: ${ReportCache[time].epicenterLon}<br>緯度: ${ReportCache[time].epicenterLat}<br>深度: ${ReportCache[time].depth}<br>規模: ${ReportCache[time].magnitudeValue}<br>位置: ${ReportCache[time].location}<br>時間: ${ReportCache[time].originTime}`);
			map.addLayer(ReportMark);
			ReportMark.setZIndexOffset(3000);
			MarkList.push(ReportMark);
		}
	}
}
const openURL = url => {
	shell.openExternal(url);
	return;
};
// #endregion

// #region Report list
function ReportList(Data, eew) {
	roll.replaceChildren();
	for (let index = 0; index < Data.response.length; index++) {
		if (eew != undefined && index == Data.response.length - 1) {
			Data.response[index].Max = eew.Max;
			Data.response[index].Time = eew.Time;
		}
		addReport(Data.response[index]);
	}
	setLocale(CONFIG["general.locale"]);
}

function addReport(report, prepend = false) {
	const Level = IntensityI(report.data[0].areaIntensity);
	let msg = "";
	if (report.location.includes("("))
		msg = report.location.substring(report.location.indexOf("(") + 1, report.location.indexOf(")")).replace("位於", "");
	else
		msg = report.location;

	let star = "";
	if (report.ID.length != 0) star += "↺ ";
	if (report.earthquakeNo % 1000 != 0) star += "✩ ";

	const Div = document.createElement("div");
	if (report.Time != undefined && report.report == undefined) {
		const report_container = document.createElement("div");
		report_container.className = "report-container locating";

		const report_intenisty_container = document.createElement("div");
		report_intenisty_container.className = "report-intenisty-container";

		const report_intenisty_title_container = document.createElement("div");
		report_intenisty_title_container.className = "report-intenisty-title-container";

		const report_intenisty_title_en = document.createElement("span");
		report_intenisty_title_en.lang = "en";
		report_intenisty_title_en.className = "report-intenisty-title";
		report_intenisty_title_en.innerText = "Max Int.";
		const report_intenisty_title_ja = document.createElement("span");
		report_intenisty_title_ja.lang = "ja";
		report_intenisty_title_ja.className = "report-intenisty-title";
		report_intenisty_title_ja.innerText = "最大震度";
		const report_intenisty_title_zh_tw = document.createElement("span");
		report_intenisty_title_zh_tw.lang = "zh-TW";
		report_intenisty_title_zh_tw.className = "report-intenisty-title";
		report_intenisty_title_zh_tw.innerText = "最大震度";

		report_intenisty_title_container.append(report_intenisty_title_en, report_intenisty_title_ja, report_intenisty_title_zh_tw);

		const report_intenisty_value = document.createElement("span");
		report_intenisty_value.className = "report-intenisty-value";
		report_intenisty_value.innerText = IntensityI(report.Max);
		report_intenisty_container.append(report_intenisty_title_container, report_intenisty_value);


		const report_detail_container = document.createElement("div");
		report_detail_container.className = "report-detail-container";

		const report_location = document.createElement("span");
		report_location.className = "report-location";
		report_location.innerText = "震源 調查中";
		const report_time = document.createElement("span");
		report_time.className = "report-time";
		report_time.innerText = report.Time.replace(/-/g, "/");
		report_detail_container.append(report_location, report_time);

		report_container.append(report_intenisty_container, report_detail_container);
		Div.prepend(report_container);
		Div.style.backgroundColor = `${color(report.Max)}cc`;
		roll.prepend(Div);
		investigation = true;
	} else {
		const report_container = document.createElement("div");
		report_container.className = "report-container";

		const report_intenisty_container = document.createElement("div");
		report_intenisty_container.className = "report-intenisty-container";

		const report_intenisty_title_container = document.createElement("div");
		report_intenisty_title_container.className = "report-intenisty-title-container";

		const report_intenisty_title_en = document.createElement("span");
		report_intenisty_title_en.lang = "en";
		report_intenisty_title_en.className = "report-intenisty-title";
		report_intenisty_title_en.innerText = "Max Int.";
		const report_intenisty_title_ja = document.createElement("span");
		report_intenisty_title_ja.lang = "ja";
		report_intenisty_title_ja.className = "report-intenisty-title";
		report_intenisty_title_ja.innerText = "最大震度";
		const report_intenisty_title_zh_tw = document.createElement("span");
		report_intenisty_title_zh_tw.lang = "zh-TW";
		report_intenisty_title_zh_tw.className = "report-intenisty-title";
		report_intenisty_title_zh_tw.innerText = "最大震度";

		report_intenisty_title_container.append(report_intenisty_title_en, report_intenisty_title_ja, report_intenisty_title_zh_tw);

		const report_intenisty_value = document.createElement("span");
		report_intenisty_value.className = "report-intenisty-value";
		report_intenisty_value.innerText = Level;
		report_intenisty_container.append(report_intenisty_title_container, report_intenisty_value);


		const report_detail_container = document.createElement("div");
		report_detail_container.className = "report-detail-container";

		const report_location = document.createElement("span");
		report_location.className = "report-location";
		report_location.innerText = `${star}${msg}`;
		const report_time = document.createElement("span");
		report_time.className = "report-time";
		report_time.innerText = report.originTime.replace(/-/g, "/");
		const report_magnitude = document.createElement("span");
		report_magnitude.className = "report-magnitude";
		report_magnitude.innerText = report.magnitudeValue.toFixed(1);
		const report_depth = document.createElement("span");
		report_depth.className = "report-depth";
		report_depth.innerText = report.depth;
		report_detail_container.append(report_location, report_time, report_magnitude, report_depth);

		report_container.append(report_intenisty_container, report_detail_container);
		Div.append(report_container);
		Div.style.backgroundColor = `${color(report.data[0].areaIntensity)}cc`;
		ReportCache[report.originTime] = report;
		Div.addEventListener("click", (event) => {
			if (event.detail == 2 && report.ID.length != 0) {
				localStorage.Test = true;
				localStorage.TestID = report.ID;
				ipcRenderer.send("restart");
			} else if (NOW.getTime() - clickT > 150)
				setTimeout(() => {
					clickT = NOW.getTime();
					ReportClick(report.originTime);
				}, 100);
		});
		if (prepend) {
			const locating = document.querySelector(".report-detail-container.locating");
			if (locating)
				locating.replaceWith(Div.children[0]);
			else {
				if (investigation) {
					investigation = false;
					roll.removeChild(roll.children[0]);
				}
				roll.prepend(Div);
			}
			if (ReportMarkID != null) {
				ReportMarkID = null;
				for (let index = 0; index < MarkList.length; index++)
					map.removeLayer(MarkList[index]);
			}
			ReportClick(report.originTime);
			ReportTag = NOW.getTime();
		} else
			roll.append(Div);
	}
}

// #endregion

// #region 設定
function setting() {
	win.setAlwaysOnTop(false);
	ipcRenderer.send("openChildWindow");
}
// #endregion

// #region PGA
function PGAcount(Scale, distance, Si) {
	let S = Si ?? 1;
	if (!CONFIG["earthquake.siteEffect"]) S = 1;
	// eslint-disable-next-line no-shadow
	const PGA = (1.657 * Math.pow(Math.E, (1.533 * Scale)) * Math.pow(distance, -1.607) * S).toFixed(3);
	return PGA >= 800 ? "7" :
		PGA <= 800 && PGA > 440 ? "6+" :
			PGA <= 440 && PGA > 250 ? "6-" :
				PGA <= 250 && PGA > 140 ? "5+" :
					PGA <= 140 && PGA > 80 ? "5-" :
						PGA <= 80 && PGA > 25 ? "4" :
							PGA <= 25 && PGA > 8 ? "3" :
								PGA <= 8 && PGA > 2.5 ? "2" :
									PGA <= 2.5 && PGA > 0.8 ? "1" :
										"0";
}
// #endregion

// #region Number >> Intensity
function IntensityI(Intensity) {
	return Intensity == 5 ? "5-" :
		Intensity == 6 ? "5+" :
			Intensity == 7 ? "6-" :
				Intensity == 8 ? "6+" :
					Intensity == 9 ? "7" :
						Intensity ?? "?";
}
// #endregion

// #region Intensity >> Number
function IntensityN(level) {
	return level == "5-" ? 5 :
		level == "5+" ? 6 :
			level == "6-" ? 7 :
				level == "6+" ? 8 :
					level == "7" ? 9 :
						Number(level);
}
// #endregion

// #region Intensity >> Class String
function IntensityToClassString(level) {
	return (level == 9) ? "seven" :
		(level == 8) ? "six strong" :
			(level == 7) ? "six" :
				(level == 6) ? "five strong" :
					(level == 5) ? "five" :
						(level == 4) ? "four" :
							(level == 3) ? "three" :
								(level == 2) ? "two" :
									(level == 1) ? "one" :
										"zero";
}
// #endregion

// #region color
function color(Intensity) {
	const Carr = ["#666666", "#0165CC", "#01BB02", "#EBC000", "#FF8400", "#E06300", "#FF0000", "#B50000", "#68009E"];
	if (Intensity == 0) return Carr[0];
	return Carr[Intensity - 1];
}
// #endregion

// #region IPC
ipcMain.on("start", () => {
	try {
		setInterval(() => {
			if (DATAstamp != 0 && Stamp != DATAstamp) {
				Stamp = DATAstamp;
				FCMdata(DATA);
			}
		}, 0);
		dump({ level: 0, message: `Initializing ServerCore >> ${ServerVer} | MD5 >> ${MD5Check}`, origin: "Initialization" });
		init();
		if (localStorage.Test != undefined)
			setTimeout(() => {
				if (localStorage.TestID != undefined) {
					delete localStorage.Test;
					const list = localStorage.TestID.split(",");
					for (let index = 0; index < list.length; index++)
						setTimeout(() => {
							dump({ level: 0, message: "Start EEW Test", origin: "EEW" });
							const data = {
								"APIkey"        : "https://github.com/ExpTechTW",
								"Function"      : "earthquake",
								"Type"          : "test",
								"FormatVersion" : 3,
								"UUID"          : localStorage.UUID,
								"ID"            : list[index],
							};
							dump({ level: 3, message: `Timer status: ${TimeDesynced ? "Desynced" : "Synced"}`, origin: "Verbose" });
							axios.post(PostIP(), data)
								.catch((error) => {
									dump({ level: 2, message: error, origin: "Verbose" });
								});
						}, 1000);
					delete localStorage.TestID;
				} else {
					delete localStorage.Test;
					dump({ level: 0, message: "Start EEW Test", origin: "EEW" });
					const data = {
						"APIkey"        : "https://github.com/ExpTechTW",
						"Function"      : "earthquake",
						"Type"          : "test",
						"FormatVersion" : 3,
						"UUID"          : localStorage.UUID,
					};
					dump({ level: 3, message: `Timer status: ${TimeDesynced ? "Desynced" : "Synced"}`, origin: "Verbose" });
					axios.post(PostIP(), data)
						.catch((error) => {
							dump({ level: 2, message: error, origin: "Verbose" });
						});
				}
			}, 3000);
	} catch (error) {
		showDialog("error", "發生錯誤", `初始化過程中發生錯誤，您可以繼續使用此應用程式，但無法保證所有功能皆能繼續正常運作。\n\n如果這是您第一次看到這個訊息，請嘗試重新啟動應用程式。\n如果這個錯誤持續出現，請到 TREM Discord 伺服器回報問題。\n\n錯誤訊息：${error}`);
		$("#load").delay(1000).fadeOut(1000);
		dump({ level: 2, message: error, origin: "Initialization" });
	}
});
ipcMain.on("testEEW", () => {
	localStorage.Test = true;
	ipcRenderer.send("restart");
});
ipcMain.on("updateTheme", async () => {
	const colors = await getThemeColors(CONFIG["theme.color"], CONFIG["theme.dark"]);

	map_geoJson.options.style = {
		weight    : 0.8,
		color     : colors.primary,
		fillColor : colors.surfaceVariant,
	};
	map_geoJson.redraw();
	/*
	mapTW_geoJson.setStyle({
		weight    : 0.8,
		opacity   : 0.3,
		color     : colors.primary,
		fillColor : colors.surfaceVariant,
	});
	*/
	console.log("updateTheme");
});
ipcMain.on("updateLocation", (e, { city, town }) => {
	setUserLocationMarker(city, town);
});
ipcMain.on("updateTitle", (e, lang) => {
	document.title = { en: "Taiwan Real-time Earthquake Monitoring", ja: "TREM 台湾リアルタイム地震モニタリング", "zh-TW": "TREM 台灣即時地震監測" }[lang];
});
// #endregion

// #region EEW
async function FCMdata(data) {
	const json = JSON.parse(data);
	if (Server.includes(json.TimeStamp)) return;
	Server.push(json.TimeStamp);
	if (json.TimeStamp != undefined)
		dump({ level: 0, message: `${NOW.getTime() - json.TimeStamp}ms`, origin: "API" });
	if (json.Function == "tsunami") {
		dump({ level: 0, message: "Got Tsunami Warning", origin: "API" });
		if (CONFIG["report.show"]) {
			win.show();
			if (CONFIG["report.cover"]) win.setAlwaysOnTop(true);
			win.setAlwaysOnTop(false);
		}
		new Notification("海嘯警報", { body: `${json["UTC+8"]} 發生 ${json.Scale} 地震\n\n東經: ${json.EastLongitude} 度\n北緯: ${json.NorthLatitude} 度`, icon: "TREM.ico" });
		focus([json.NorthLatitude, json.EastLongitude], 2.5);
		const myIcon = L.icon({
			iconUrl  : "./image/warn.png",
			iconSize : [30, 30],
		});
		const Cross = L.marker([Number(json.NorthLatitude), Number(json.EastLongitude)], { icon: myIcon });
		if (Tsunami.Cross != undefined) map.removeLayer(Tsunami.Cross);
		Tsunami.Cross = Cross;
		Tsunami.Time = NOW.getTime();
		map.addLayer(Cross);
		if (CONFIG["report.show"]) {
			win.show();
			if (CONFIG["report.cover"]) win.setAlwaysOnTop(true);
			win.setAlwaysOnTop(false);
		}
		if (CONFIG["report.audio"]) audioPlay("./audio/Water.wav");
	} else if (json.Function == "TSUNAMI") {
		if (Number(json.Version) == 1) {
			new Notification("海嘯警報", { body: `${json["UTC+8"]} 發生 ${json.Scale} 地震\n\n東經: ${json.EastLongitude} 度\n北緯: ${json.NorthLatitude} 度`, icon: "TREM.ico" });
			if (CONFIG["report.show"]) {
				win.show();
				if (CONFIG["report.cover"]) win.setAlwaysOnTop(true);
				win.setAlwaysOnTop(false);
			}
			if (CONFIG["report.audio"]) audioPlay("./audio/Water.wav");
			focus([23.608428, 120.799168], 7.5);
			setTimeout(() => {ipcRenderer.send("screenshotEEW", json);}, 1500);
		}
		if (TSUNAMI["Timer"] != null) clearInterval(TSUNAMI["Timer"]);
		TSUNAMI["Timer"] = setInterval(() => {
			if (TSUNAMI["E"] != null || json.Cancel) {
				map.removeLayer(TSUNAMI["E"]);
				map.removeLayer(TSUNAMI["EN"]);
				map.removeLayer(TSUNAMI["ES"]);
				map.removeLayer(TSUNAMI["N"]);
				map.removeLayer(TSUNAMI["WS"]);
				map.removeLayer(TSUNAMI["W"]);
				if (Tsunami.Cross != undefined) map.removeLayer(Tsunami.Cross);
				TSUNAMI["E"] = null;
				if (json.Cancel) {
					TSUNAMI = {};
					clearInterval(TSUNAMI["Timer"]);
				}
			} else {
				const myIcon = L.icon({
					iconUrl  : "./image/warn.png",
					iconSize : [30, 30],
				});
				const Cross = L.marker([Number(json.NorthLatitude), Number(json.EastLongitude)], { icon: myIcon });
				Tsunami.Cross = Cross;
				Tsunami.Time = NOW.getTime();
				map.addLayer(Cross);
				TSUNAMI["E"] = L.geoJson(E, {
					style: {
						weight    : 10,
						opacity   : 1,
						color     : Tcolor(json.Addition[0].areaColor),
						fillColor : "transparent",
					},
				});
				TSUNAMI["EN"] = L.geoJson(EN, {
					style: {
						weight    : 10,
						opacity   : 1,
						color     : Tcolor(json.Addition[1].areaColor),
						fillColor : "transparent",
					},
				});
				TSUNAMI["ES"] = L.geoJson(ES, {
					style: {
						weight    : 10,
						opacity   : 1,
						color     : Tcolor(json.Addition[2].areaColor),
						fillColor : "transparent",
					},
				});
				TSUNAMI["N"] = L.geoJson(N, {
					style: {
						weight    : 10,
						opacity   : 1,
						color     : Tcolor(json.Addition[3].areaColor),
						fillColor : "transparent",
					},
				});
				TSUNAMI["WS"] = L.geoJson(WS, {
					style: {
						weight    : 10,
						opacity   : 1,
						color     : Tcolor(json.Addition[4].areaColor),
						fillColor : "transparent",
					},
				});
				TSUNAMI["W"] = L.geoJson(W, {
					style: {
						weight    : 10,
						opacity   : 1,
						color     : Tcolor(json.Addition[5].areaColor),
						fillColor : "transparent",
					},
				});
				map.addLayer(TSUNAMI["E"]);
				map.addLayer(TSUNAMI["EN"]);
				map.addLayer(TSUNAMI["ES"]);
				map.addLayer(TSUNAMI["N"]);
				map.addLayer(TSUNAMI["WS"]);
				map.addLayer(TSUNAMI["W"]);
			}
		}, 1000);
		function Tcolor(text) {
			return (text == "黃色") ? "yellow" :
				(text == "橙色") ? "red" :
					(text == "綠色") ? "transparent" :
						"purple";
		}
	} else if (json.Function == "palert")
		PAlert = json.Data;
	else if (json.Function == "TREM_earthquake")
		TREM = json;
	else if (json.Function == "Replay") {
		replay = json.timestamp;
		replayT = NOW.getTime();
	} else if (json.Function == "report") {
		if (Pgeojson != null) {
			map.removeLayer(Pgeojson);
			Pgeojson = null;
		}
		dump({ level: 0, message: "Got Earthquake Report", origin: "API" });
		if (CONFIG["report.show"]) {
			win.show();
			if (CONFIG["report.cover"]) win.setAlwaysOnTop(true);
			win.setAlwaysOnTop(false);
		}
		if (CONFIG["report.audio"]) audioPlay("./audio/Report.wav");
		new Notification("地震報告", { body: `${json.Location.substring(json.Location.indexOf("(") + 1, json.Location.indexOf(")")).replace("位於", "")}\n${json["UTC+8"]}\n發生 M${json.Scale} 有感地震`, icon: "TREM.ico" });
		const report = await getReportByData();
		addReport(report.response[0], true);
		setTimeout(() => {
			ipcRenderer.send("screenshotEEW", {
				"ID"      : json.ID + "-" + NOW.getTime(),
				"Version" : "R",
			});
		}, 5000);
	} else if (json.Function != undefined && json.Function.includes("earthquake") || json.Replay || json.Test) {
		if (!json.Replay && !json.Test) {
			if (json.Function == "ICL_earthquake" && !CONFIG["accept.eew.ICL"]) return;
			if (json.Function == "NIED_earthquake" && !CONFIG["accept.eew.NIED"]) return;
			if (json.Function == "JMA_earthquake" && !CONFIG["accept.eew.JMA"]) return;
			if (json.Function == "KMA_earthquake" && !CONFIG["accept.eew.KMA"]) return;
			if (json.Function == "earthquake" && !CONFIG["accept.eew.CWB"]) return;
			if (json.Function == "FJDZJ_earthquake" && !CONFIG["accept.eew.FJDZJ"]) return;
			eew();
		} else
			eew();

		async function eew() {
			dump({ level: 0, message: "Got EEW", origin: "API" });
			console.debug(json);

			// handler
			Info.ID = json.ID;
			if (EarthquakeList[json.ID] == undefined) EarthquakeList[json.ID] = {};
			EarthquakeList[json.ID].Time = json.Time;
			EarthquakeList[json.ID].ID = json.ID;
			let value = 0;
			let distance = 0;
			const res = await fetch("https://raw.githubusercontent.com/ExpTechTW/TW-EEW/master/locations.json");
			const location = await res.json();
			const GC = {};
			let level;
			let MaxIntensity = 0;
			if (expected.length != 0)
				for (let index = 0; index < expected.length; index++)
					map.removeLayer(expected[index]);

			for (let index = 0; index < Object.keys(location).length; index++) {
				const city = Object.keys(location)[index];
				for (let Index = 0; Index < Object.keys(location[city]).length; Index++) {
					const town = Object.keys(location[city])[Index];
					const point = Math.sqrt(Math.pow(Math.abs(location[city][town][1] + (Number(json.NorthLatitude) * -1)) * 111, 2) + Math.pow(Math.abs(location[city][town][2] + (Number(json.EastLongitude) * -1)) * 101, 2));
					const Distance = Math.sqrt(Math.pow(Number(json.Depth), 2) + Math.pow(point, 2));
					const Level = PGAcount(json.Scale, Distance, location[city][town][3]);
					if (UserLocationLat == location[city][town][1] && UserLocationLon == location[city][town][2]) {
						if (CONFIG["auto.waveSpeed"])
							if (Distance < 50) {
								Pspeed = 6.5;
								Sspeed = 3.5;
							}

						level = Level;
						value = Math.round((Distance - ((NOW.getTime() - json.Time) / 1000) * Sspeed) / Sspeed) - 5;
						distance = Distance;
					}
					const Intensity = IntensityN(Level);
					if (Intensity > MaxIntensity) MaxIntensity = Intensity;
					GC[city + town] = Intensity;
				}
			}

			const Intensity = IntensityN(level);
			if (Intensity < Number(CONFIG["eew.Intensity"]) && !json.Replay) {
				TimeDesynced = false;
				return;
			}

			if (geojson != null) mapTW.removeLayer(geojson);
			const colors = await getThemeColors(CONFIG["theme.color"], CONFIG["theme.dark"]);
			geojson = L.geoJson(DmapT, {
				style: (feature) => {
					if (feature.properties.COUNTY != undefined) {
						const name = feature.properties.COUNTY + feature.properties.TOWN;
						if (GC[name] == 0 || GC[name] == undefined)
							return {
								weight      : 1,
								opacity     : 0.8,
								color       : "#8E8E8E",
								dashArray   : "",
								fillOpacity : 0.8,
								fillColor   : colors.surfaceVariant,
							};
						return {
							weight      : 1,
							opacity     : 0.8,
							color       : "#8E8E8E",
							dashArray   : "",
							fillOpacity : 0.8,
							fillColor   : color(GC[name]),
						};
					} else
						return {
							weight      : 1,
							opacity     : 0.8,
							color       : "#8E8E8E",
							dashArray   : "",
							fillOpacity : 0.8,
							fillColor   : colors.surfaceVariant,
						};
				},
			});
			mapTW.addLayer(geojson);
			if (!Info.Notify.includes(json.ID)) {
				if (CONFIG["eew.show"]) {
					win.show();
					win.flashFrame(true);
					if (CONFIG["eew.cover"]) win.setAlwaysOnTop(true);
					win.setAlwaysOnTop(false);
				}
				let Nmsg = "";
				if (value > 0)
					Nmsg = `${value}秒後抵達`;
				else
					Nmsg = "已抵達 (預警盲區)";

				new Notification("EEW 強震即時警報", { body: `${level.replace("+", "強").replace("-", "弱")}級地震，${Nmsg}\nM ${json.Scale} ${json.Location ?? "未知區域"}`, icon: "TREM.ico" });
				Info.Notify.push(json.ID);
				EEWT.id = json.ID;
				if (CONFIG["eew.audio"]) audioPlay("./audio/EEW.wav");
				audioPlay1(`./audio/1/${level.replace("+", "").replace("-", "")}.wav`);
				if (level.includes("+"))
					audioPlay1("./audio/1/intensity-strong.wav");
				else if (level.includes("-"))
					audioPlay1("./audio/1/intensity-weak.wav");
				else
					audioPlay1("./audio/1/intensity.wav");

				if (value > 0 && value < 100) {
					if (value <= 10)
						audioPlay1(`./audio/1/${value.toString()}.wav`);
					else if (value < 20)
						audioPlay1(`./audio/1/x${value.toString().substring(1, 2)}.wav`);
					else {
						audioPlay1(`./audio/1/${value.toString().substring(0, 1)}x.wav`);
						audioPlay1(`./audio/1/x${value.toString().substring(1, 2)}.wav`);
					}
					audioPlay1("./audio/1/second.wav");
				}
			}
			if (!Info.Warn.includes(json.ID) && MaxIntensity >= 5) {
				Info.Warn.push(json.ID);
				json.Alert = true;
				audioPlay("./audio/Alert.wav");
				audioPlay("./audio/Alert.wav");
				audioPlay("./audio/Alert.wav");
				audioPlay("./audio/Alert.wav");
				audioPlay("./audio/Alert.wav");
			} else
				json.Alert = false;

			let _time = -1;
			let stamp = 0;
			if (json.ID + json.Version != Info.Alert) {
				EEW[json.ID] = {
					lon  : Number(json.EastLongitude),
					lat  : Number(json.NorthLatitude),
					time : 0,
					Time : json.Time,
					id   : json.ID,
				};
				Info.Alert = json.ID + json.Version;
				value = Math.round((distance - ((NOW.getTime() - json.Time) / 1000) * Sspeed) / Sspeed);
				if (Second == -1 || value < Second) {
					if (t != null) clearInterval(t);
					t = setInterval(() => {
						value = Math.round((distance - ((NOW.getTime() - json.Time) / 1000) * Sspeed) / Sspeed);
						Second = value;
						if (stamp != value && !audioLock1) {
							stamp = value;
							if (_time >= 0) {
								audioPlay("./audio/1/ding.wav");
								_time++;
								if (_time >= 10)
									clearInterval(t);
							} else if (value < 100) {
								if (arrive.includes(json.ID)) {
									clearInterval(t);
									return;
								}
								if (value > 10)
									if (value.toString().substring(1, 2) == "0") {
										audioPlay1(`./audio/1/${value.toString().substring(0, 1)}x.wav`);
										audioPlay1("./audio/1/x0.wav");
									} else
										audioPlay("./audio/1/ding.wav");

								else if (value > 0)
									audioPlay1(`./audio/1/${value.toString()}.wav`);
								else {
									arrive.push(json.ID);
									audioPlay1("./audio/1/arrive.wav");
									_time = 0;
								}
							}
						}
					}, 0);
				}
			}
			if (ReportMarkID != null) {
				ReportMarkID = null;
				for (let index = 0; index < MarkList.length; index++)
					map.removeLayer(MarkList[index]);

			}
			let speed = 500;
			if (CONFIG["shock.smoothing"]) speed = 0;
			if (EarthquakeList[json.ID].Timer != undefined) clearInterval(EarthquakeList[json.ID].Timer);
			if (EarthquakeList.ITimer != undefined) clearInterval(EarthquakeList.ITimer);


			// AlertBox: 種類
			let classString = "alert-box ";
			if (json.Replay) {
				replay = json.timestamp;
				replayT = NOW.getTime();
			}
			if (json.Test)
				classString += "eew-test";
			else if (json.Alert)
				classString += "eew-alert";
			else
				classString += "eew-pred";

			let find = -1;
			for (let index = 0; index < INFO.length; index++)
				if (INFO[index].ID == json.ID) {
					find = index;
					break;
				}

			if (find == -1) find = INFO.length;
			INFO[find] = {
				"ID"            : json.ID,
				alert_number    : json.Version,
				alert_intensity : MaxIntensity,
				alert_location  : json.Location ?? "未知區域",
				alert_time      : new Date(json["UTC+8"]),
				alert_sTime     : new Date(json.Time),
				alert_local     : IntensityN(level),
				alert_magnitude : json.Scale,
				alert_depth     : json.Depth,
				alert_provider  : json.Unit,
				alert_type      : classString,
				"intensity-1"   : `<font color="white" size="7"><b>${IntensityI(MaxIntensity)}</b></font>`,
				"time-1"        : `<font color="white" size="2"><b>${json["UTC+8"]}</b></font>`,
				"info-1"        : `<font color="white" size="4"><b>M ${json.Scale} </b></font><font color="white" size="3"><b> 深度: ${json.Depth} km</b></font>`,
				"distance"      : distance,
			};

			// switch to main view
			$("#mainView_btn")[0].click();
			// remember navrail state
			const navState = !$("#nav-rail").hasClass("hide");
			// hide navrail so the view goes fullscreen
			if (navState) toggleNav(false);
			// hide report to make screen clean
			$(roll).fadeOut(200);
			// show minimap
			$("#map-tw").addClass("show");

			updateText();

			if (ITimer == null)
				ITimer = setInterval(() => {
					updateText();
					if (ticker == null)
						ticker = setInterval(() => {
							if (TINFO + 1 >= INFO.length)
								TINFO = 0;
							else TINFO++;
						}, 5000);
				}, 1000);
			EEWshot = NOW.getTime() - 4000;
			EEWshotC = 0;
			if (EarthquakeList[json.ID].Cross != undefined) map.removeLayer(EarthquakeList[json.ID].Cross);
			if (EarthquakeList[json.ID].Cross1 != undefined) mapTW.removeLayer(EarthquakeList[json.ID].Cross1);
			let S1 = 0;
			EarthquakeList[json.ID].Timer = setInterval(() => {
				if (EarthquakeList[json.ID].Cancel == undefined) {
					if (CONFIG["shock.p"]) {
						if (EarthquakeList[json.ID].Pcircle != null)
							map.removeLayer(EarthquakeList[json.ID].Pcircle);
						if (EarthquakeList[json.ID].Pcircle1 != null)
							mapTW.removeLayer(EarthquakeList[json.ID].Pcircle1);
						const km = Math.sqrt(Math.pow((NOW.getTime() - json.Time) * Pspeed, 2) - Math.pow(Number(json.Depth) * 1000, 2));
						if (km > 0) {
							EarthquakeList[json.ID].Pcircle = L.circle([Number(json.NorthLatitude), Number(json.EastLongitude)], {
								color     : "#6FB7B7",
								fillColor : "transparent",
								radius    : km,
							});
							EarthquakeList[json.ID].Pcircle1 = L.circle([Number(json.NorthLatitude), Number(json.EastLongitude)], {
								color     : "#6FB7B7",
								fillColor : "transparent",
								radius    : km,
							});
							map.addLayer(EarthquakeList[json.ID].Pcircle);
							mapTW.addLayer(EarthquakeList[json.ID].Pcircle1);
						}
					}
					if (EarthquakeList[json.ID].Scircle != null)
						map.removeLayer(EarthquakeList[json.ID].Scircle);
					if (EarthquakeList[json.ID].Scircle1 != null)
						mapTW.removeLayer(EarthquakeList[json.ID].Scircle1);
					const km = Math.pow((NOW.getTime() - json.Time) * Sspeed, 2) - Math.pow(Number(json.Depth) * 1000, 2);
					if (EarthquakeList[json.ID].Depth != null) map.removeLayer(EarthquakeList[json.ID].Depth);
					if (km > 0) {
						const KM = Math.sqrt(km);
						EarthquakeList[json.ID].Scircle = L.circle([Number(json.NorthLatitude), Number(json.EastLongitude)], {
							color       : json.Alert ? "red" : "orange",
							fillColor   : "#F8E7E7",
							fillOpacity : 0.1,
							radius      : KM,
						});
						EarthquakeList[json.ID].Scircle1 = L.circle([Number(json.NorthLatitude), Number(json.EastLongitude)], {
							color       : json.Alert ? "red" : "orange",
							fillColor   : "#F8E7E7",
							fillOpacity : 0.1,
							radius      : KM,
						});
						map.addLayer(EarthquakeList[json.ID].Scircle);
						mapTW.addLayer(EarthquakeList[json.ID].Scircle1);
					} else {
						let Progress = 0;
						const num = Math.round(((NOW.getTime() - json.Time) * Sspeed / (json.Depth * 1000)) * 100);
						if (num > 35) Progress = 1;
						if (num > 55) Progress = 2;
						if (num > 75) Progress = 3;
						if (num > 98) Progress = 4;
						const myIcon = L.icon({
							iconUrl  : `./image/progress${Progress}.png`,
							iconSize : [50, 50],
						});
						const DepthM = L.marker([Number(json.NorthLatitude), Number(json.EastLongitude) + 0.15], { icon: myIcon });
						EarthquakeList[json.ID].Depth = DepthM;
						map.addLayer(DepthM);
						DepthM.setZIndexOffset(6000);
					}
					if (NOW.getMilliseconds() < 500 && S1 == 0) {
						S1 = 1;
						let myIcon;
						let X = 0;
						let Y = 0;
						if (Object.keys(EarthquakeList).length != 1) {
							let find = 1;
							for (let index = 0; index < Object.keys(EarthquakeList).length; index++)
								if (Object.keys(EarthquakeList)[index] == json.ID) {
									find = index + 1;
									break;
								}
							if (find <= 4) {
								myIcon = L.icon({
									iconUrl  : `./image/cross${find}.png`,
									iconSize : [40, 40],
								});
								if (find == 1) Y = 0.03;
								if (find == 2) X = 0.03;
								if (find == 3) Y = -0.03;
								if (find == 4) X = -0.03;
							} else
								myIcon = L.icon({
									iconUrl  : "./image/cross.png",
									iconSize : [30, 30],
								});
						} else
							myIcon = L.icon({
								iconUrl  : "./image/cross.png",
								iconSize : [30, 30],
							});

						const Cross = L.marker([Number(json.NorthLatitude) + Y, Number(json.EastLongitude) + X], { icon: myIcon });
						const Cross1 = L.marker([Number(json.NorthLatitude) + Y, Number(json.EastLongitude) + X], { icon: myIcon });
						EarthquakeList[json.ID].Cross = Cross;
						map.addLayer(Cross);
						EarthquakeList[json.ID].Cross1 = Cross1;
						mapTW.addLayer(Cross1);
						Cross.setZIndexOffset(6000);
						if (NOW.getTime() - EEWshot > 60000)
							EEWshotC = 0;
						if (NOW.getTime() - EEWshot > 5000 && EEWshotC <= 1 && S1 == 1) {
							EEWshotC++;
							json.Version = json.Version + "-" + EEWshotC;
							EEWshot = NOW.getTime();
							setTimeout(() => {ipcRenderer.send("screenshotEEW", json);}, 500);
						}
					} else if (NOW.getMilliseconds() > 500 && S1 == 1) {
						S1 = 0;
						map.removeLayer(EarthquakeList[json.ID].Cross);
						mapTW.removeLayer(EarthquakeList[json.ID].Cross1);
						delete EarthquakeList[json.ID].Cross;
						delete EarthquakeList[json.ID].Cross1;
					}
				}
				if (json.Cancel && EarthquakeList[json.ID].Cancel == undefined)
					for (let index = 0; index < INFO.length; index++)
						if (INFO[index].ID == json.ID) {
							INFO[index].alert_provider += " (取消)";
							clear(json.ID);
							json.TimeStamp = NOW.getTime() - 210000;
							EarthquakeList[json.ID].Cancel = true;
							if (Object.keys(EarthquakeList).length == 1) {
								clearInterval(t);
								audioList = [];
								audioList1 = [];
							}
							break;
						}
				if (NOW.getTime() - json.TimeStamp > 240000) {
					clear(json.ID);
					map.removeLayer(EarthquakeList[json.ID].Cross);
					mapTW.removeLayer(EarthquakeList[json.ID].Cross1);
					for (let index = 0; index < INFO.length; index++)
						if (INFO[index].ID == json.ID) {
							TINFO = 0;
							INFO.splice(index, 1);
							break;
						}
					clearInterval(EarthquakeList[json.ID].Timer);
					document.getElementById("box-10").innerHTML = "";
					delete EarthquakeList[json.ID];
					delete EEW[json.ID];
					if (Object.keys(EarthquakeList).length == 0) {
						clearInterval(t);
						audioList = [];
						audioList1 = [];
						Second = -1;
						clearInterval(ITimer);
						// hide eew alert
						ITimer = null;
						ticker = null;
						replay = 0;
						TimeDesynced = false;
						INFO = [];
						map.removeLayer(geojson);
						for (let index = 0; index < expected.length; index++)
							map.removeLayer(expected[index]);

						expected = [];
						$("#alert-box").removeClass("show");
						// hide minimap
						$("#map-tw").removeClass("show");
						// restore reports
						$(roll).fadeIn(200);
					}
				}
			}, speed);
			setTimeout(() => {
				if (CONFIG["webhook.url"] != "") {
					const Now = NOW.getFullYear() +
						"/" + (NOW.getMonth() + 1) +
						"/" + NOW.getDate() +
						" " + NOW.getHours() +
						":" + NOW.getMinutes() +
						":" + NOW.getSeconds();

					let msg = CONFIG["webhook.body"];
					msg = msg.replace("%Depth%", json.Depth).replace("%NorthLatitude%", json.NorthLatitude).replace("%Time%", json["UTC+8"]).replace("%EastLongitude%", json.EastLongitude).replace("%Scale%", json.Scale);
					if (json.Function == "earthquake")
						msg = msg.replace("%Provider%", "中華民國交通部中央氣象局");
					else if (json.Function == "JP_earthquake")
						msg = msg.replace("%Provider%", "日本氣象廳");
					else if (json.Function == "CN_earthquake")
						msg = msg.replace("%Provider%", "福建省地震局");

					msg = JSON.parse(msg);
					msg.username = "TREM | 台灣實時地震監測";

					msg.embeds[0].image.url = "";
					msg.embeds[0].footer = {
						"text"     : `ExpTech Studio ${Now}`,
						"icon_url" : "https://raw.githubusercontent.com/ExpTechTW/API/master/image/Icon/ExpTech.png",
					};
					dump({ level: 0, message: "Posting Webhook", origin: "Webhook" });
					axios.post(CONFIG["webhook.url"], msg)
						.catch((error) => {
							dump({ level: 2, message: error, origin: "Webhook" });
						});
				}
			}, 2000);
		}
	}
}
// #endregion

function clear(ID) {
	if (EarthquakeList[ID].Scircle != undefined) map.removeLayer(EarthquakeList[ID].Scircle);
	if (EarthquakeList[ID].Pcircle != undefined) map.removeLayer(EarthquakeList[ID].Pcircle);
	if (EarthquakeList[ID].Scircle1 != undefined) mapTW.removeLayer(EarthquakeList[ID].Scircle1);
	if (EarthquakeList[ID].Pcircle1 != undefined) mapTW.removeLayer(EarthquakeList[ID].Pcircle1);
}

function updateText() {
	$("#alert-box")[0].className = `${INFO[TINFO].alert_type} ${IntensityToClassString(INFO[TINFO].alert_intensity)}`;
	$("#alert-local")[0].className = `alert-item ${IntensityToClassString(INFO[TINFO].alert_local)}`;
	$("#alert-provider").text(`${INFO.length > 1 ? `${TINFO + 1} ` : ""}${INFO[TINFO].alert_provider}`);
	$("#alert-number").text(`${INFO[TINFO].alert_number}`);
	$("#alert-location").text(INFO[TINFO].alert_location);
	$("#alert-time").text(INFO[TINFO].alert_time.format("YYYY/MM/DD HH:mm:ss"));
	$("#alert-magnitude").text(INFO[TINFO].alert_magnitude);
	$("#alert-depth").text(INFO[TINFO].alert_depth);
	$("#alert-box").addClass("show");


	if (EarthquakeList[INFO[TINFO].ID].Cancel != undefined) {
		document.getElementById("alert-s").innerText = "X";
		document.getElementById("alert-p").innerText = "X";
	} else {
		let num = Math.round((INFO[TINFO].distance - ((NOW.getTime() - INFO[TINFO].alert_sTime.getTime()) / 1000) * Sspeed) / Sspeed);
		if (num <= 0) num = "";
		document.getElementById("alert-s").innerText = `${num}`;
		num = Math.round((INFO[TINFO].distance - ((NOW.getTime() - INFO[TINFO].alert_sTime.getTime()) / 1000) * Pspeed) / Pspeed);
		if (num <= 0) num = "";
		document.getElementById("alert-p").innerText = `${num}`;
	}

	const Num = Math.round(((NOW.getTime() - INFO[TINFO].Time) * 4 / 10) / INFO[TINFO].Depth);
	const Catch = document.getElementById("box-10");
	if (Num <= 100)
		Catch.innerHTML = `<font color="white" size="6"><b>震波到地表進度: ${Num}%</b></font>`;
	else
		Catch.innerHTML = "";
}
