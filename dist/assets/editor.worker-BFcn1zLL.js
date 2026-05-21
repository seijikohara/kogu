(function() {
	var is = class {
		constructor() {
			this.listeners = [], this.unexpectedErrorHandler = function(e) {
				setTimeout(() => {
					throw e.stack ? Ft.isErrorNoTelemetry(e) ? new Ft(e.message + `

` + e.stack) : /* @__PURE__ */ new Error(e.message + `

` + e.stack) : e;
				}, 0);
			};
		}
		emit(e) {
			this.listeners.forEach((t) => {
				t(e);
			});
		}
		onUnexpectedError(e) {
			this.unexpectedErrorHandler(e), this.emit(e);
		}
		onUnexpectedExternalError(e) {
			this.unexpectedErrorHandler(e);
		}
	};
	const as = new is();
	function rt(e) {
		os(e) || as.onUnexpectedError(e);
	}
	function Tt(e) {
		if (e instanceof Error) {
			const { name: t, message: n, cause: r } = e;
			return {
				$isError: !0,
				name: t,
				message: n,
				stack: e.stacktrace || e.stack,
				noTelemetry: Ft.isErrorNoTelemetry(e),
				cause: r ? Tt(r) : void 0,
				code: e.code
			};
		}
		return e;
	}
	const ls = "Canceled";
	function os(e) {
		return e instanceof A1 ? !0 : e instanceof Error && e.name === "Canceled" && e.message === "Canceled";
	}
	var A1 = class extends Error {
		constructor() {
			super(ls), this.name = this.message;
		}
	}, Ft = class y1 extends Error {
		constructor(t) {
			super(t), this.name = "CodeExpectedError";
		}
		static fromError(t) {
			if (t instanceof y1) return t;
			const n = new y1();
			return n.message = t.message, n.stack = t.stack, n;
		}
		static isErrorNoTelemetry(t) {
			return t.name === "CodeExpectedError";
		}
	}, Z = class Or extends Error {
		constructor(t) {
			super(t || "An unexpected bug occurred."), Object.setPrototypeOf(this, Or.prototype);
		}
	};
	function us(e, t = "Unreachable") {
		throw new Error(t);
	}
	function cs(e, t = "unexpected state") {
		if (!e) throw typeof t == "string" ? new Z(`Assertion Failed: ${t}`) : t;
	}
	function st(e) {
		if (!e()) {
			debugger;
			e(), rt(new Z("Assertion Failed"));
		}
	}
	function C1(e, t) {
		let n = 0;
		for (; n < e.length - 1;) {
			const r = e[n], s = e[n + 1];
			if (!t(r, s)) return !1;
			n++;
		}
		return !0;
	}
	function hs(e) {
		return typeof e == "string";
	}
	function ms(e) {
		return !!e && typeof e[Symbol.iterator] == "function";
	}
	var it;
	(function(e) {
		function t(w) {
			return !!w && typeof w == "object" && typeof w[Symbol.iterator] == "function";
		}
		e.is = t;
		const n = Object.freeze([]);
		function r() {
			return n;
		}
		e.empty = r;
		function* s(w) {
			yield w;
		}
		e.single = s;
		function a(w) {
			return t(w) ? w : s(w);
		}
		e.wrap = a;
		function l(w) {
			return w || n;
		}
		e.from = l;
		function* o(w) {
			for (let C = w.length - 1; C >= 0; C--) yield w[C];
		}
		e.reverse = o;
		function u(w) {
			return !w || w[Symbol.iterator]().next().done === !0;
		}
		e.isEmpty = u;
		function c(w) {
			return w[Symbol.iterator]().next().value;
		}
		e.first = c;
		function m(w, C) {
			let T = 0;
			for (const U of w) if (C(U, T++)) return !0;
			return !1;
		}
		e.some = m;
		function h(w, C) {
			let T = 0;
			for (const U of w) if (!C(U, T++)) return !1;
			return !0;
		}
		e.every = h;
		function d(w, C) {
			for (const T of w) if (C(T)) return T;
		}
		e.find = d;
		function* f(w, C) {
			for (const T of w) C(T) && (yield T);
		}
		e.filter = f;
		function* b(w, C) {
			let T = 0;
			for (const U of w) yield C(U, T++);
		}
		e.map = b;
		function* p(w, C) {
			let T = 0;
			for (const U of w) yield* C(U, T++);
		}
		e.flatMap = p;
		function* y(...w) {
			for (const C of w) ms(C) ? yield* C : yield C;
		}
		e.concat = y;
		function v(w, C, T) {
			let U = T;
			for (const x of w) U = C(U, x);
			return U;
		}
		e.reduce = v;
		function L(w) {
			let C = 0;
			for (const T of w) C++;
			return C;
		}
		e.length = L;
		function* _(w, C, T = w.length) {
			for (C < -w.length && (C = 0), C < 0 && (C += w.length), T < 0 ? T += w.length : T > w.length && (T = w.length); C < T; C++) yield w[C];
		}
		e.slice = _;
		function N(w, C = Number.POSITIVE_INFINITY) {
			const T = [];
			if (C === 0) return [T, w];
			const U = w[Symbol.iterator]();
			for (let x = 0; x < C; x++) {
				const R = U.next();
				if (R.done) return [T, e.empty()];
				T.push(R.value);
			}
			return [T, { [Symbol.iterator]() {
				return U;
			} }];
		}
		e.consume = N;
		async function k(w) {
			const C = [];
			for await (const T of w) C.push(T);
			return C;
		}
		e.asyncToArray = k;
		async function M(w) {
			let C = [];
			for await (const T of w) C = C.concat(T);
			return C;
		}
		e.asyncToArrayFlat = M;
	})(it || (it = {}));
	function x1(e) {
		if (it.is(e)) {
			const t = [];
			for (const n of e) if (n) try {
				n.dispose();
			} catch (r) {
				t.push(r);
			}
			if (t.length === 1) throw t[0];
			if (t.length > 1) throw new AggregateError(t, "Encountered errors while disposing of store");
			return Array.isArray(e) ? [] : e;
		} else if (e) return e.dispose(), e;
	}
	function fs(...e) {
		return at(() => x1(e));
	}
	var gs = class {
		constructor(e) {
			this._isDisposed = !1, this._fn = e;
		}
		dispose() {
			if (!this._isDisposed) {
				if (!this._fn) throw new Error("Unbound disposable context: Need to use an arrow function to preserve the value of this");
				this._isDisposed = !0, this._fn();
			}
		}
	};
	function at(e) {
		return new gs(e);
	}
	var It = class Gr {
		static #e = this.DISABLE_DISPOSED_WARNING = !1;
		constructor() {
			this._toDispose = /* @__PURE__ */ new Set(), this._isDisposed = !1;
		}
		dispose() {
			this._isDisposed || (this._isDisposed = !0, this.clear());
		}
		get isDisposed() {
			return this._isDisposed;
		}
		clear() {
			if (this._toDispose.size !== 0) try {
				x1(this._toDispose);
			} finally {
				this._toDispose.clear();
			}
		}
		add(t) {
			if (!t || t === $e.None) return t;
			if (t === this) throw new Error("Cannot register a disposable on itself!");
			return this._isDisposed ? Gr.DISABLE_DISPOSED_WARNING || console.warn((/* @__PURE__ */ new Error("Trying to add a disposable to a DisposableStore that has already been disposed of. The added object will be leaked!")).stack) : this._toDispose.add(t), t;
		}
		delete(t) {
			if (t) {
				if (t === this) throw new Error("Cannot dispose a disposable on itself!");
				this._toDispose.delete(t), t.dispose();
			}
		}
	}, $e = class {
		static #e = this.None = Object.freeze({ dispose() {} });
		constructor() {
			this._store = new It(), this._store;
		}
		dispose() {
			this._store.dispose();
		}
		_register(e) {
			if (e === this) throw new Error("Cannot register a disposable on itself!");
			return this._store.add(e);
		}
	}, O = class Ct {
		static #e = this.Undefined = new Ct(void 0);
		constructor(t) {
			this.element = t, this.next = Ct.Undefined, this.prev = Ct.Undefined;
		}
	}, ds = class {
		constructor() {
			this._first = O.Undefined, this._last = O.Undefined, this._size = 0;
		}
		get size() {
			return this._size;
		}
		isEmpty() {
			return this._first === O.Undefined;
		}
		clear() {
			let e = this._first;
			for (; e !== O.Undefined;) {
				const t = e.next;
				e.prev = O.Undefined, e.next = O.Undefined, e = t;
			}
			this._first = O.Undefined, this._last = O.Undefined, this._size = 0;
		}
		unshift(e) {
			return this._insert(e, !1);
		}
		push(e) {
			return this._insert(e, !0);
		}
		_insert(e, t) {
			const n = new O(e);
			if (this._first === O.Undefined) this._first = n, this._last = n;
			else if (t) {
				const s = this._last;
				this._last = n, n.prev = s, s.next = n;
			} else {
				const s = this._first;
				this._first = n, n.next = s, s.prev = n;
			}
			this._size += 1;
			let r = !1;
			return () => {
				r || (r = !0, this._remove(n));
			};
		}
		shift() {
			if (this._first !== O.Undefined) {
				const e = this._first.element;
				return this._remove(this._first), e;
			}
		}
		pop() {
			if (this._last !== O.Undefined) {
				const e = this._last.element;
				return this._remove(this._last), e;
			}
		}
		_remove(e) {
			if (e.prev !== O.Undefined && e.next !== O.Undefined) {
				const t = e.prev;
				t.next = e.next, e.next.prev = t;
			} else e.prev === O.Undefined && e.next === O.Undefined ? (this._first = O.Undefined, this._last = O.Undefined) : e.next === O.Undefined ? (this._last = this._last.prev, this._last.next = O.Undefined) : e.prev === O.Undefined && (this._first = this._first.next, this._first.prev = O.Undefined);
			this._size -= 1;
		}
		*[Symbol.iterator]() {
			let e = this._first;
			for (; e !== O.Undefined;) yield e.element, e = e.next;
		}
	};
	const ps = globalThis.performance.now.bind(globalThis.performance);
	var k1 = class jr {
		static create(t) {
			return new jr(t);
		}
		constructor(t) {
			this._now = t === !1 ? Date.now : ps, this._startTime = this._now(), this._stopTime = -1;
		}
		stop() {
			this._stopTime = this._now();
		}
		reset() {
			this._startTime = this._now(), this._stopTime = -1;
		}
		elapsed() {
			return this._stopTime !== -1 ? this._stopTime - this._startTime : this._now() - this._startTime;
		}
	}, Vt;
	(function(e) {
		e.None = () => $e.None;
		function t(R, S) {
			return d(R, () => {}, 0, void 0, !0, void 0, S);
		}
		e.defer = t;
		function n(R) {
			return (S, E = null, A) => {
				let F = !1, B;
				return B = R((H) => {
					if (!F) return B ? B.dispose() : F = !0, S.call(E, H);
				}, null, A), F && B.dispose(), B;
			};
		}
		e.once = n;
		function r(R, S) {
			return e.once(e.filter(R, S));
		}
		e.onceIf = r;
		function s(R, S, E) {
			return m((A, F = null, B) => R((H) => A.call(F, S(H)), null, B), E);
		}
		e.map = s;
		function a(R, S, E) {
			return m((A, F = null, B) => R((H) => {
				S(H), A.call(F, H);
			}, null, B), E);
		}
		e.forEach = a;
		function l(R, S, E) {
			return m((A, F = null, B) => R((H) => S(H) && A.call(F, H), null, B), E);
		}
		e.filter = l;
		function o(R) {
			return R;
		}
		e.signal = o;
		function u(...R) {
			return (S, E = null, A) => h(fs(...R.map((F) => F((B) => S.call(E, B)))), A);
		}
		e.any = u;
		function c(R, S, E, A) {
			let F = E;
			return s(R, (B) => (F = S(F, B), F), A);
		}
		e.reduce = c;
		function m(R, S) {
			let E;
			const A = new ue({
				onWillAddFirstListener() {
					E = R(A.fire, A);
				},
				onDidRemoveLastListener() {
					E?.dispose();
				}
			});
			return S?.add(A), A.event;
		}
		function h(R, S) {
			return S instanceof Array ? S.push(R) : S && S.add(R), R;
		}
		function d(R, S, E = 100, A = !1, F = !1, B, H) {
			let Y, J, Ae, Rt = 0, Ze;
			const At = new ue({
				leakWarningThreshold: B,
				onWillAddFirstListener() {
					Y = R((f0) => {
						Rt++, J = S(J, f0), A && !Ae && (At.fire(J), J = void 0), Ze = () => {
							const g0 = J;
							J = void 0, Ae = void 0, (!A || Rt > 1) && At.fire(g0), Rt = 0;
						}, typeof E == "number" ? (Ae && clearTimeout(Ae), Ae = setTimeout(Ze, E)) : Ae === void 0 && (Ae = null, queueMicrotask(Ze));
					});
				},
				onWillRemoveListener() {
					F && Rt > 0 && Ze?.();
				},
				onDidRemoveLastListener() {
					Ze = void 0, Y.dispose();
				}
			});
			return H?.add(At), At.event;
		}
		e.debounce = d;
		function f(R, S = 0, E) {
			return e.debounce(R, (A, F) => A ? (A.push(F), A) : [F], S, void 0, !0, void 0, E);
		}
		e.accumulate = f;
		function b(R, S = (A, F) => A === F, E) {
			let A = !0, F;
			return l(R, (B) => {
				const H = A || !S(B, F);
				return A = !1, F = B, H;
			}, E);
		}
		e.latch = b;
		function p(R, S, E) {
			return [e.filter(R, S, E), e.filter(R, (A) => !S(A), E)];
		}
		e.split = p;
		function y(R, S = !1, E = [], A) {
			let F = E.slice(), B = R((J) => {
				F ? F.push(J) : Y.fire(J);
			});
			A && A.add(B);
			const H = () => {
				F?.forEach((J) => Y.fire(J)), F = null;
			}, Y = new ue({
				onWillAddFirstListener() {
					B || (B = R((J) => Y.fire(J)), A && A.add(B));
				},
				onDidAddFirstListener() {
					F && (S ? setTimeout(H) : H());
				},
				onDidRemoveLastListener() {
					B && B.dispose(), B = null;
				}
			});
			return A && A.add(Y), Y.event;
		}
		e.buffer = y;
		function v(R, S) {
			return (A, F, B) => {
				const H = S(new _());
				return R(function(Y) {
					const J = H.evaluate(Y);
					J !== L && A.call(F, J);
				}, void 0, B);
			};
		}
		e.chain = v;
		const L = Symbol("HaltChainable");
		class _ {
			constructor() {
				this.steps = [];
			}
			map(S) {
				return this.steps.push(S), this;
			}
			forEach(S) {
				return this.steps.push((E) => (S(E), E)), this;
			}
			filter(S) {
				return this.steps.push((E) => S(E) ? E : L), this;
			}
			reduce(S, E) {
				let A = E;
				return this.steps.push((F) => (A = S(A, F), A)), this;
			}
			latch(S = (E, A) => E === A) {
				let E = !0, A;
				return this.steps.push((F) => {
					const B = E || !S(F, A);
					return E = !1, A = F, B ? F : L;
				}), this;
			}
			evaluate(S) {
				for (const E of this.steps) if (S = E(S), S === L) break;
				return S;
			}
		}
		function N(R, S, E = (A) => A) {
			const A = (...Y) => H.fire(E(...Y)), F = () => R.on(S, A), B = () => R.removeListener(S, A), H = new ue({
				onWillAddFirstListener: F,
				onDidRemoveLastListener: B
			});
			return H.event;
		}
		e.fromNodeEventEmitter = N;
		function k(R, S, E = (A) => A) {
			const A = (...Y) => H.fire(E(...Y)), F = () => R.addEventListener(S, A), B = () => R.removeEventListener(S, A), H = new ue({
				onWillAddFirstListener: F,
				onDidRemoveLastListener: B
			});
			return H.event;
		}
		e.fromDOMEventEmitter = k;
		function M(R, S) {
			let E;
			const A = new Promise((F, B) => {
				const H = n(R)(F, null, S);
				E = () => H.dispose();
			});
			return A.cancel = E, A;
		}
		e.toPromise = M;
		function w(R, S) {
			return R((E) => S.fire(E));
		}
		e.forward = w;
		function C(R, S, E) {
			return S(E), R((A) => S(A));
		}
		e.runAndSubscribe = C;
		class T {
			constructor(S, E) {
				this._observable = S, this._counter = 0, this._hasChanged = !1;
				const A = {
					onWillAddFirstListener: () => {
						S.addObserver(this), this._observable.reportChanges();
					},
					onDidRemoveLastListener: () => {
						S.removeObserver(this);
					}
				};
				this.emitter = new ue(A), E && E.add(this.emitter);
			}
			beginUpdate(S) {
				this._counter++;
			}
			handlePossibleChange(S) {}
			handleChange(S, E) {
				this._hasChanged = !0;
			}
			endUpdate(S) {
				this._counter--, this._counter === 0 && (this._observable.reportChanges(), this._hasChanged && (this._hasChanged = !1, this.emitter.fire(this._observable.get())));
			}
		}
		function U(R, S) {
			return new T(R, S).emitter.event;
		}
		e.fromObservable = U;
		function x(R) {
			return (S, E, A) => {
				let F = 0, B = !1;
				const H = {
					beginUpdate() {
						F++;
					},
					endUpdate() {
						F--, F === 0 && (R.reportChanges(), B && (B = !1, S.call(E)));
					},
					handlePossibleChange() {},
					handleChange() {
						B = !0;
					}
				};
				R.addObserver(H), R.reportChanges();
				const Y = { dispose() {
					R.removeObserver(H);
				} };
				return A instanceof It ? A.add(Y) : Array.isArray(A) && A.push(Y), Y;
			};
		}
		e.fromObservableLight = x;
	})(Vt || (Vt = {}));
	var bs = class _1 {
		static #e = this.all = /* @__PURE__ */ new Set();
		static #t = this._idPool = 0;
		constructor(t) {
			this.listenerCount = 0, this.invocationCount = 0, this.elapsedOverall = 0, this.durations = [], this.name = `${t}_${_1._idPool++}`, _1.all.add(this);
		}
		start(t) {
			this._stopWatch = new k1(), this.listenerCount = t;
		}
		stop() {
			if (this._stopWatch) {
				const t = this._stopWatch.elapsed();
				this.durations.push(t), this.elapsedOverall += t, this.invocationCount += 1, this._stopWatch = void 0;
			}
		}
	};
	let ws = -1;
	var ys = class Xr {
		static #e = this._idPool = 1;
		constructor(t, n, r = (Xr._idPool++).toString(16).padStart(3, "0")) {
			this._errorHandler = t, this.threshold = n, this.name = r, this._warnCountdown = 0;
		}
		dispose() {
			this._stacks?.clear();
		}
		check(t, n) {
			const r = this.threshold;
			if (r <= 0 || n < r) return;
			this._stacks || (this._stacks = /* @__PURE__ */ new Map());
			const s = this._stacks.get(t.value) || 0;
			if (this._stacks.set(t.value, s + 1), this._warnCountdown -= 1, this._warnCountdown <= 0) {
				this._warnCountdown = r * .5;
				const [a, l] = this.getMostFrequentStack(), o = `[${this.name}] potential listener LEAK detected, having ${n} listeners already. MOST frequent listener (${l}):`;
				console.warn(o), console.warn(a);
				const u = new vs(o, a);
				this._errorHandler(u);
			}
			return () => {
				const a = this._stacks.get(t.value) || 0;
				this._stacks.set(t.value, a - 1);
			};
		}
		getMostFrequentStack() {
			if (!this._stacks) return;
			let t, n = 0;
			for (const [r, s] of this._stacks) (!t || n < s) && (t = [r, s], n = s);
			return t;
		}
	}, _s = class Qr {
		static create() {
			return new Qr((/* @__PURE__ */ new Error()).stack ?? "");
		}
		constructor(t) {
			this.value = t;
		}
		print() {
			console.warn(this.value.split(`
`).slice(2).join(`
`));
		}
	}, vs = class extends Error {
		constructor(e, t) {
			super(e), this.name = "ListenerLeakError", this.stack = t;
		}
	}, Ls = class extends Error {
		constructor(e, t) {
			super(e), this.name = "ListenerRefusalError", this.stack = t;
		}
	}, Bt = class {
		constructor(e) {
			this.value = e;
		}
	};
	const Ns = 2;
	var ue = class {
		constructor(e) {
			this._size = 0, this._options = e, this._leakageMon = this._options?.leakWarningThreshold ? new ys(e?.onListenerError ?? rt, this._options?.leakWarningThreshold ?? ws) : void 0, this._perfMon = this._options?._profName ? new bs(this._options._profName) : void 0, this._deliveryQueue = this._options?.deliveryQueue;
		}
		dispose() {
			this._disposed || (this._disposed = !0, this._deliveryQueue?.current === this && this._deliveryQueue.reset(), this._listeners && (this._listeners = void 0, this._size = 0), this._options?.onDidRemoveLastListener?.(), this._leakageMon?.dispose());
		}
		get event() {
			return this._event ??= (e, t, n) => {
				if (this._leakageMon && this._size > this._leakageMon.threshold ** 2) {
					const l = `[${this._leakageMon.name}] REFUSES to accept new listeners because it exceeded its threshold by far (${this._size} vs ${this._leakageMon.threshold})`;
					console.warn(l);
					const o = this._leakageMon.getMostFrequentStack() ?? ["UNKNOWN stack", -1], u = new Ls(`${l}. HINT: Stack shows most frequent listener (${o[1]}-times)`, o[0]);
					return (this._options?.onListenerError || rt)(u), $e.None;
				}
				if (this._disposed) return $e.None;
				t && (e = e.bind(t));
				const r = new Bt(e);
				let s;
				this._leakageMon && this._size >= Math.ceil(this._leakageMon.threshold * .2) && (r.stack = _s.create(), s = this._leakageMon.check(r.stack, this._size + 1)), this._listeners ? this._listeners instanceof Bt ? (this._deliveryQueue ??= new Ss(), this._listeners = [this._listeners, r]) : this._listeners.push(r) : (this._options?.onWillAddFirstListener?.(this), this._listeners = r, this._options?.onDidAddFirstListener?.(this)), this._options?.onDidAddListener?.(this), this._size++;
				const a = at(() => {
					s?.(), this._removeListener(r);
				});
				return n instanceof It ? n.add(a) : Array.isArray(n) && n.push(a), a;
			}, this._event;
		}
		_removeListener(e) {
			if (this._options?.onWillRemoveListener?.(this), !this._listeners) return;
			if (this._size === 1) {
				this._listeners = void 0, this._options?.onDidRemoveLastListener?.(this), this._size = 0;
				return;
			}
			const t = this._listeners, n = t.indexOf(e);
			if (n === -1) throw console.log("disposed?", this._disposed), console.log("size?", this._size), console.log("arr?", JSON.stringify(this._listeners)), /* @__PURE__ */ new Error("Attempted to dispose unknown listener");
			this._size--, t[n] = void 0;
			const r = this._deliveryQueue.current === this;
			if (this._size * Ns <= t.length) {
				let s = 0;
				for (let a = 0; a < t.length; a++) t[a] ? t[s++] = t[a] : r && s < this._deliveryQueue.end && (this._deliveryQueue.end--, s < this._deliveryQueue.i && this._deliveryQueue.i--);
				t.length = s;
			}
		}
		_deliver(e, t) {
			if (!e) return;
			const n = this._options?.onListenerError || rt;
			if (!n) {
				e.value(t);
				return;
			}
			try {
				e.value(t);
			} catch (r) {
				n(r);
			}
		}
		_deliverQueue(e) {
			const t = e.current._listeners;
			for (; e.i < e.end;) this._deliver(t[e.i++], e.value);
			e.reset();
		}
		fire(e) {
			if (this._deliveryQueue?.current && (this._deliverQueue(this._deliveryQueue), this._perfMon?.stop()), this._perfMon?.start(this._size), this._listeners) if (this._listeners instanceof Bt) this._deliver(this._listeners, e);
			else {
				const t = this._deliveryQueue;
				t.enqueue(this, e, this._listeners.length), this._deliverQueue(t);
			}
			this._perfMon?.stop();
		}
		hasListeners() {
			return this._size > 0;
		}
	}, Ss = class {
		constructor() {
			this.i = -1, this.end = 0;
		}
		enqueue(e, t, n) {
			this.i = 0, this.end = n, this.current = e, this.value = t;
		}
		reset() {
			this.i = this.end, this.current = void 0, this.value = void 0;
		}
	};
	function Rs() {
		return globalThis._VSCODE_NLS_MESSAGES;
	}
	function M1() {
		return globalThis._VSCODE_NLS_LANGUAGE;
	}
	const As = M1() === "pseudo" || typeof document < "u" && document.location && typeof document.location.hash == "string" && document.location.hash.indexOf("pseudo=true") >= 0;
	function E1(e, t) {
		let n;
		return t.length === 0 ? n = e : n = e.replace(/\{(\d+)\}/g, (r, s) => {
			const a = t[s[0]];
			let l = r;
			return typeof a == "string" ? l = a : (typeof a == "number" || typeof a == "boolean" || a === void 0 || a === null) && (l = String(a)), l;
		}), As && (n = "［" + n.replace(/[aouei]/g, "$&$&") + "］"), n;
	}
	function D(e, t, ...n) {
		return E1(typeof e == "number" ? Cs(e, t) : t, n);
	}
	function Cs(e, t) {
		const n = Rs()?.[e];
		if (typeof n != "string") {
			if (typeof t == "string") return t;
			throw new Error(`!!! NLS MISSING: ${e} !!!`);
		}
		return n;
	}
	let lt = !1, ot = !1, ut = !1, P1 = !1, he;
	const me = globalThis;
	let ee;
	typeof me.vscode < "u" && typeof me.vscode.process < "u" ? ee = me.vscode.process : typeof process < "u" && typeof process?.versions?.node == "string" && (ee = process);
	const Es = typeof ee?.versions?.electron == "string" && ee?.type === "renderer";
	if (typeof ee == "object") {
		lt = ee.platform === "win32", ot = ee.platform === "darwin", ut = ee.platform === "linux", ut && ee.env.SNAP && ee.env.SNAP_REVISION, ee.env.CI || ee.env.BUILD_ARTIFACTSTAGINGDIRECTORY || ee.env.GITHUB_WORKSPACE;
		const e = ee.env.VSCODE_NLS_CONFIG;
		if (e) try {
			const t = JSON.parse(e);
			t.userLocale, t.osLocale, t.resolvedLanguage, t.languagePack?.translationsConfigFile;
		} catch {}
	} else typeof navigator == "object" && !Es ? (he = navigator.userAgent, lt = he.indexOf("Windows") >= 0, ot = he.indexOf("Macintosh") >= 0, (he.indexOf("Macintosh") >= 0 || he.indexOf("iPad") >= 0 || he.indexOf("iPhone") >= 0) && navigator.maxTouchPoints && navigator.maxTouchPoints, ut = he.indexOf("Linux") >= 0, he?.indexOf("Mobi"), P1 = !0, M1(), navigator.language.toLowerCase()) : console.error("Unable to resolve platform.");
	const ze = lt, Ps = ot;
	P1 && typeof me.importScripts == "function" && me.origin;
	const ce = he, Ds = typeof me.postMessage == "function" && !me.importScripts;
	(() => {
		if (Ds) {
			const e = [];
			me.addEventListener("message", (n) => {
				if (n.data && n.data.vscodeScheduleAsyncWork) for (let r = 0, s = e.length; r < s; r++) {
					const a = e[r];
					if (a.id === n.data.vscodeScheduleAsyncWork) {
						e.splice(r, 1), a.callback();
						return;
					}
				}
			});
			let t = 0;
			return (n) => {
				const r = ++t;
				e.push({
					id: r,
					callback: n
				}), me.postMessage({ vscodeScheduleAsyncWork: r }, "*");
			};
		}
		return (e) => setTimeout(e);
	})();
	const Fs = !!(ce && ce.indexOf("Chrome") >= 0);
	ce && ce.indexOf("Firefox");
	!Fs && ce && ce.indexOf("Safari");
	ce && ce.indexOf("Edg/");
	ce && ce.indexOf("Android");
	function Is(e) {
		return e;
	}
	var Vs = class {
		constructor(e, t) {
			this.lastCache = void 0, this.lastArgKey = void 0, typeof e == "function" ? (this._fn = e, this._computeKey = Is) : (this._fn = t, this._computeKey = e.getCacheKey);
		}
		get(e) {
			const t = this._computeKey(e);
			return this.lastArgKey !== t && (this.lastArgKey = t, this.lastCache = this._fn(e)), this.lastCache;
		}
	}, Le;
	(function(e) {
		e[e.Uninitialized = 0] = "Uninitialized", e[e.Running = 1] = "Running", e[e.Completed = 2] = "Completed";
	})(Le || (Le = {}));
	var Ht = class {
		constructor(e) {
			this.executor = e, this._state = Le.Uninitialized;
		}
		get value() {
			if (this._state === Le.Uninitialized) {
				this._state = Le.Running;
				try {
					this._value = this.executor();
				} catch (e) {
					this._error = e;
				} finally {
					this._state = Le.Completed;
				}
			} else if (this._state === Le.Running) throw new Error("Cannot read the value of a lazy that is being initialized");
			if (this._error) throw this._error;
			return this._value;
		}
		get rawValue() {
			return this._value;
		}
	};
	function Bs(e) {
		return e.replace(/[\\\{\}\*\+\?\|\^\$\.\[\]\(\)]/g, "\\$&");
	}
	function qs(e) {
		return e.source === "^" || e.source === "^$" || e.source === "$" || e.source === "^\\s*$" ? !1 : !!(e.exec("") && e.lastIndex === 0);
	}
	function Us(e) {
		return e.split(/\r\n|\r|\n/);
	}
	function Hs(e) {
		for (let t = 0, n = e.length; t < n; t++) {
			const r = e.charCodeAt(t);
			if (r !== 32 && r !== 9) return t;
		}
		return -1;
	}
	function Ws(e, t = e.length - 1) {
		for (let n = t; n >= 0; n--) {
			const r = e.charCodeAt(n);
			if (r !== 32 && r !== 9) return n;
		}
		return -1;
	}
	function D1(e) {
		return e >= 65 && e <= 90;
	}
	function $s(e, t) {
		const n = Math.min(e.length, t.length);
		let r;
		for (r = 0; r < n; r++) if (e.charCodeAt(r) !== t.charCodeAt(r)) return r;
		return n;
	}
	function zs(e, t) {
		const n = Math.min(e.length, t.length);
		let r;
		const s = e.length - 1, a = t.length - 1;
		for (r = 0; r < n; r++) if (e.charCodeAt(s - r) !== t.charCodeAt(a - r)) return r;
		return n;
	}
	function ct(e) {
		return 55296 <= e && e <= 56319;
	}
	function Wt(e) {
		return 56320 <= e && e <= 57343;
	}
	function T1(e, t) {
		return (e - 55296 << 10) + (t - 56320) + 65536;
	}
	function Os(e, t, n) {
		const r = e.charCodeAt(n);
		if (ct(r) && n + 1 < t) {
			const s = e.charCodeAt(n + 1);
			if (Wt(s)) return T1(r, s);
		}
		return r;
	}
	const Gs = /^[\t\n\r\x20-\x7E]*$/;
	function js(e) {
		return Gs.test(e);
	}
	(class Ke {
		static #e = this._INSTANCE = null;
		static getInstance() {
			return Ke._INSTANCE || (Ke._INSTANCE = new Ke()), Ke._INSTANCE;
		}
		constructor() {
			this._data = Xs();
		}
		getGraphemeBreakType(t) {
			if (t < 32) return t === 10 ? 3 : t === 13 ? 2 : 4;
			if (t < 127) return 0;
			const n = this._data, r = n.length / 3;
			let s = 1;
			for (; s <= r;) if (t < n[3 * s]) s = 2 * s;
			else if (t > n[3 * s + 1]) s = 2 * s + 1;
			else return n[3 * s + 2];
			return 0;
		}
	});
	function Xs() {
		return JSON.parse("[0,0,0,51229,51255,12,44061,44087,12,127462,127487,6,7083,7085,5,47645,47671,12,54813,54839,12,128678,128678,14,3270,3270,5,9919,9923,14,45853,45879,12,49437,49463,12,53021,53047,12,71216,71218,7,128398,128399,14,129360,129374,14,2519,2519,5,4448,4519,9,9742,9742,14,12336,12336,14,44957,44983,12,46749,46775,12,48541,48567,12,50333,50359,12,52125,52151,12,53917,53943,12,69888,69890,5,73018,73018,5,127990,127990,14,128558,128559,14,128759,128760,14,129653,129655,14,2027,2035,5,2891,2892,7,3761,3761,5,6683,6683,5,8293,8293,4,9825,9826,14,9999,9999,14,43452,43453,5,44509,44535,12,45405,45431,12,46301,46327,12,47197,47223,12,48093,48119,12,48989,49015,12,49885,49911,12,50781,50807,12,51677,51703,12,52573,52599,12,53469,53495,12,54365,54391,12,65279,65279,4,70471,70472,7,72145,72147,7,119173,119179,5,127799,127818,14,128240,128244,14,128512,128512,14,128652,128652,14,128721,128722,14,129292,129292,14,129445,129450,14,129734,129743,14,1476,1477,5,2366,2368,7,2750,2752,7,3076,3076,5,3415,3415,5,4141,4144,5,6109,6109,5,6964,6964,5,7394,7400,5,9197,9198,14,9770,9770,14,9877,9877,14,9968,9969,14,10084,10084,14,43052,43052,5,43713,43713,5,44285,44311,12,44733,44759,12,45181,45207,12,45629,45655,12,46077,46103,12,46525,46551,12,46973,46999,12,47421,47447,12,47869,47895,12,48317,48343,12,48765,48791,12,49213,49239,12,49661,49687,12,50109,50135,12,50557,50583,12,51005,51031,12,51453,51479,12,51901,51927,12,52349,52375,12,52797,52823,12,53245,53271,12,53693,53719,12,54141,54167,12,54589,54615,12,55037,55063,12,69506,69509,5,70191,70193,5,70841,70841,7,71463,71467,5,72330,72342,5,94031,94031,5,123628,123631,5,127763,127765,14,127941,127941,14,128043,128062,14,128302,128317,14,128465,128467,14,128539,128539,14,128640,128640,14,128662,128662,14,128703,128703,14,128745,128745,14,129004,129007,14,129329,129330,14,129402,129402,14,129483,129483,14,129686,129704,14,130048,131069,14,173,173,4,1757,1757,1,2200,2207,5,2434,2435,7,2631,2632,5,2817,2817,5,3008,3008,5,3201,3201,5,3387,3388,5,3542,3542,5,3902,3903,7,4190,4192,5,6002,6003,5,6439,6440,5,6765,6770,7,7019,7027,5,7154,7155,7,8205,8205,13,8505,8505,14,9654,9654,14,9757,9757,14,9792,9792,14,9852,9853,14,9890,9894,14,9937,9937,14,9981,9981,14,10035,10036,14,11035,11036,14,42654,42655,5,43346,43347,7,43587,43587,5,44006,44007,7,44173,44199,12,44397,44423,12,44621,44647,12,44845,44871,12,45069,45095,12,45293,45319,12,45517,45543,12,45741,45767,12,45965,45991,12,46189,46215,12,46413,46439,12,46637,46663,12,46861,46887,12,47085,47111,12,47309,47335,12,47533,47559,12,47757,47783,12,47981,48007,12,48205,48231,12,48429,48455,12,48653,48679,12,48877,48903,12,49101,49127,12,49325,49351,12,49549,49575,12,49773,49799,12,49997,50023,12,50221,50247,12,50445,50471,12,50669,50695,12,50893,50919,12,51117,51143,12,51341,51367,12,51565,51591,12,51789,51815,12,52013,52039,12,52237,52263,12,52461,52487,12,52685,52711,12,52909,52935,12,53133,53159,12,53357,53383,12,53581,53607,12,53805,53831,12,54029,54055,12,54253,54279,12,54477,54503,12,54701,54727,12,54925,54951,12,55149,55175,12,68101,68102,5,69762,69762,7,70067,70069,7,70371,70378,5,70720,70721,7,71087,71087,5,71341,71341,5,71995,71996,5,72249,72249,7,72850,72871,5,73109,73109,5,118576,118598,5,121505,121519,5,127245,127247,14,127568,127569,14,127777,127777,14,127872,127891,14,127956,127967,14,128015,128016,14,128110,128172,14,128259,128259,14,128367,128368,14,128424,128424,14,128488,128488,14,128530,128532,14,128550,128551,14,128566,128566,14,128647,128647,14,128656,128656,14,128667,128673,14,128691,128693,14,128715,128715,14,128728,128732,14,128752,128752,14,128765,128767,14,129096,129103,14,129311,129311,14,129344,129349,14,129394,129394,14,129413,129425,14,129466,129471,14,129511,129535,14,129664,129666,14,129719,129722,14,129760,129767,14,917536,917631,5,13,13,2,1160,1161,5,1564,1564,4,1807,1807,1,2085,2087,5,2307,2307,7,2382,2383,7,2497,2500,5,2563,2563,7,2677,2677,5,2763,2764,7,2879,2879,5,2914,2915,5,3021,3021,5,3142,3144,5,3263,3263,5,3285,3286,5,3398,3400,7,3530,3530,5,3633,3633,5,3864,3865,5,3974,3975,5,4155,4156,7,4229,4230,5,5909,5909,7,6078,6085,7,6277,6278,5,6451,6456,7,6744,6750,5,6846,6846,5,6972,6972,5,7074,7077,5,7146,7148,7,7222,7223,5,7416,7417,5,8234,8238,4,8417,8417,5,9000,9000,14,9203,9203,14,9730,9731,14,9748,9749,14,9762,9763,14,9776,9783,14,9800,9811,14,9831,9831,14,9872,9873,14,9882,9882,14,9900,9903,14,9929,9933,14,9941,9960,14,9974,9974,14,9989,9989,14,10006,10006,14,10062,10062,14,10160,10160,14,11647,11647,5,12953,12953,14,43019,43019,5,43232,43249,5,43443,43443,5,43567,43568,7,43696,43696,5,43765,43765,7,44013,44013,5,44117,44143,12,44229,44255,12,44341,44367,12,44453,44479,12,44565,44591,12,44677,44703,12,44789,44815,12,44901,44927,12,45013,45039,12,45125,45151,12,45237,45263,12,45349,45375,12,45461,45487,12,45573,45599,12,45685,45711,12,45797,45823,12,45909,45935,12,46021,46047,12,46133,46159,12,46245,46271,12,46357,46383,12,46469,46495,12,46581,46607,12,46693,46719,12,46805,46831,12,46917,46943,12,47029,47055,12,47141,47167,12,47253,47279,12,47365,47391,12,47477,47503,12,47589,47615,12,47701,47727,12,47813,47839,12,47925,47951,12,48037,48063,12,48149,48175,12,48261,48287,12,48373,48399,12,48485,48511,12,48597,48623,12,48709,48735,12,48821,48847,12,48933,48959,12,49045,49071,12,49157,49183,12,49269,49295,12,49381,49407,12,49493,49519,12,49605,49631,12,49717,49743,12,49829,49855,12,49941,49967,12,50053,50079,12,50165,50191,12,50277,50303,12,50389,50415,12,50501,50527,12,50613,50639,12,50725,50751,12,50837,50863,12,50949,50975,12,51061,51087,12,51173,51199,12,51285,51311,12,51397,51423,12,51509,51535,12,51621,51647,12,51733,51759,12,51845,51871,12,51957,51983,12,52069,52095,12,52181,52207,12,52293,52319,12,52405,52431,12,52517,52543,12,52629,52655,12,52741,52767,12,52853,52879,12,52965,52991,12,53077,53103,12,53189,53215,12,53301,53327,12,53413,53439,12,53525,53551,12,53637,53663,12,53749,53775,12,53861,53887,12,53973,53999,12,54085,54111,12,54197,54223,12,54309,54335,12,54421,54447,12,54533,54559,12,54645,54671,12,54757,54783,12,54869,54895,12,54981,55007,12,55093,55119,12,55243,55291,10,66045,66045,5,68325,68326,5,69688,69702,5,69817,69818,5,69957,69958,7,70089,70092,5,70198,70199,5,70462,70462,5,70502,70508,5,70750,70750,5,70846,70846,7,71100,71101,5,71230,71230,7,71351,71351,5,71737,71738,5,72000,72000,7,72160,72160,5,72273,72278,5,72752,72758,5,72882,72883,5,73031,73031,5,73461,73462,7,94192,94193,7,119149,119149,7,121403,121452,5,122915,122916,5,126980,126980,14,127358,127359,14,127535,127535,14,127759,127759,14,127771,127771,14,127792,127793,14,127825,127867,14,127897,127899,14,127945,127945,14,127985,127986,14,128000,128007,14,128021,128021,14,128066,128100,14,128184,128235,14,128249,128252,14,128266,128276,14,128335,128335,14,128379,128390,14,128407,128419,14,128444,128444,14,128481,128481,14,128499,128499,14,128526,128526,14,128536,128536,14,128543,128543,14,128556,128556,14,128564,128564,14,128577,128580,14,128643,128645,14,128649,128649,14,128654,128654,14,128660,128660,14,128664,128664,14,128675,128675,14,128686,128689,14,128695,128696,14,128705,128709,14,128717,128719,14,128725,128725,14,128736,128741,14,128747,128748,14,128755,128755,14,128762,128762,14,128981,128991,14,129009,129023,14,129160,129167,14,129296,129304,14,129320,129327,14,129340,129342,14,129356,129356,14,129388,129392,14,129399,129400,14,129404,129407,14,129432,129442,14,129454,129455,14,129473,129474,14,129485,129487,14,129648,129651,14,129659,129660,14,129671,129679,14,129709,129711,14,129728,129730,14,129751,129753,14,129776,129782,14,917505,917505,4,917760,917999,5,10,10,3,127,159,4,768,879,5,1471,1471,5,1536,1541,1,1648,1648,5,1767,1768,5,1840,1866,5,2070,2073,5,2137,2139,5,2274,2274,1,2363,2363,7,2377,2380,7,2402,2403,5,2494,2494,5,2507,2508,7,2558,2558,5,2622,2624,7,2641,2641,5,2691,2691,7,2759,2760,5,2786,2787,5,2876,2876,5,2881,2884,5,2901,2902,5,3006,3006,5,3014,3016,7,3072,3072,5,3134,3136,5,3157,3158,5,3260,3260,5,3266,3266,5,3274,3275,7,3328,3329,5,3391,3392,7,3405,3405,5,3457,3457,5,3536,3537,7,3551,3551,5,3636,3642,5,3764,3772,5,3895,3895,5,3967,3967,7,3993,4028,5,4146,4151,5,4182,4183,7,4226,4226,5,4253,4253,5,4957,4959,5,5940,5940,7,6070,6070,7,6087,6088,7,6158,6158,4,6432,6434,5,6448,6449,7,6679,6680,5,6742,6742,5,6754,6754,5,6783,6783,5,6912,6915,5,6966,6970,5,6978,6978,5,7042,7042,7,7080,7081,5,7143,7143,7,7150,7150,7,7212,7219,5,7380,7392,5,7412,7412,5,8203,8203,4,8232,8232,4,8265,8265,14,8400,8412,5,8421,8432,5,8617,8618,14,9167,9167,14,9200,9200,14,9410,9410,14,9723,9726,14,9733,9733,14,9745,9745,14,9752,9752,14,9760,9760,14,9766,9766,14,9774,9774,14,9786,9786,14,9794,9794,14,9823,9823,14,9828,9828,14,9833,9850,14,9855,9855,14,9875,9875,14,9880,9880,14,9885,9887,14,9896,9897,14,9906,9916,14,9926,9927,14,9935,9935,14,9939,9939,14,9962,9962,14,9972,9972,14,9978,9978,14,9986,9986,14,9997,9997,14,10002,10002,14,10017,10017,14,10055,10055,14,10071,10071,14,10133,10135,14,10548,10549,14,11093,11093,14,12330,12333,5,12441,12442,5,42608,42610,5,43010,43010,5,43045,43046,5,43188,43203,7,43302,43309,5,43392,43394,5,43446,43449,5,43493,43493,5,43571,43572,7,43597,43597,7,43703,43704,5,43756,43757,5,44003,44004,7,44009,44010,7,44033,44059,12,44089,44115,12,44145,44171,12,44201,44227,12,44257,44283,12,44313,44339,12,44369,44395,12,44425,44451,12,44481,44507,12,44537,44563,12,44593,44619,12,44649,44675,12,44705,44731,12,44761,44787,12,44817,44843,12,44873,44899,12,44929,44955,12,44985,45011,12,45041,45067,12,45097,45123,12,45153,45179,12,45209,45235,12,45265,45291,12,45321,45347,12,45377,45403,12,45433,45459,12,45489,45515,12,45545,45571,12,45601,45627,12,45657,45683,12,45713,45739,12,45769,45795,12,45825,45851,12,45881,45907,12,45937,45963,12,45993,46019,12,46049,46075,12,46105,46131,12,46161,46187,12,46217,46243,12,46273,46299,12,46329,46355,12,46385,46411,12,46441,46467,12,46497,46523,12,46553,46579,12,46609,46635,12,46665,46691,12,46721,46747,12,46777,46803,12,46833,46859,12,46889,46915,12,46945,46971,12,47001,47027,12,47057,47083,12,47113,47139,12,47169,47195,12,47225,47251,12,47281,47307,12,47337,47363,12,47393,47419,12,47449,47475,12,47505,47531,12,47561,47587,12,47617,47643,12,47673,47699,12,47729,47755,12,47785,47811,12,47841,47867,12,47897,47923,12,47953,47979,12,48009,48035,12,48065,48091,12,48121,48147,12,48177,48203,12,48233,48259,12,48289,48315,12,48345,48371,12,48401,48427,12,48457,48483,12,48513,48539,12,48569,48595,12,48625,48651,12,48681,48707,12,48737,48763,12,48793,48819,12,48849,48875,12,48905,48931,12,48961,48987,12,49017,49043,12,49073,49099,12,49129,49155,12,49185,49211,12,49241,49267,12,49297,49323,12,49353,49379,12,49409,49435,12,49465,49491,12,49521,49547,12,49577,49603,12,49633,49659,12,49689,49715,12,49745,49771,12,49801,49827,12,49857,49883,12,49913,49939,12,49969,49995,12,50025,50051,12,50081,50107,12,50137,50163,12,50193,50219,12,50249,50275,12,50305,50331,12,50361,50387,12,50417,50443,12,50473,50499,12,50529,50555,12,50585,50611,12,50641,50667,12,50697,50723,12,50753,50779,12,50809,50835,12,50865,50891,12,50921,50947,12,50977,51003,12,51033,51059,12,51089,51115,12,51145,51171,12,51201,51227,12,51257,51283,12,51313,51339,12,51369,51395,12,51425,51451,12,51481,51507,12,51537,51563,12,51593,51619,12,51649,51675,12,51705,51731,12,51761,51787,12,51817,51843,12,51873,51899,12,51929,51955,12,51985,52011,12,52041,52067,12,52097,52123,12,52153,52179,12,52209,52235,12,52265,52291,12,52321,52347,12,52377,52403,12,52433,52459,12,52489,52515,12,52545,52571,12,52601,52627,12,52657,52683,12,52713,52739,12,52769,52795,12,52825,52851,12,52881,52907,12,52937,52963,12,52993,53019,12,53049,53075,12,53105,53131,12,53161,53187,12,53217,53243,12,53273,53299,12,53329,53355,12,53385,53411,12,53441,53467,12,53497,53523,12,53553,53579,12,53609,53635,12,53665,53691,12,53721,53747,12,53777,53803,12,53833,53859,12,53889,53915,12,53945,53971,12,54001,54027,12,54057,54083,12,54113,54139,12,54169,54195,12,54225,54251,12,54281,54307,12,54337,54363,12,54393,54419,12,54449,54475,12,54505,54531,12,54561,54587,12,54617,54643,12,54673,54699,12,54729,54755,12,54785,54811,12,54841,54867,12,54897,54923,12,54953,54979,12,55009,55035,12,55065,55091,12,55121,55147,12,55177,55203,12,65024,65039,5,65520,65528,4,66422,66426,5,68152,68154,5,69291,69292,5,69633,69633,5,69747,69748,5,69811,69814,5,69826,69826,5,69932,69932,7,70016,70017,5,70079,70080,7,70095,70095,5,70196,70196,5,70367,70367,5,70402,70403,7,70464,70464,5,70487,70487,5,70709,70711,7,70725,70725,7,70833,70834,7,70843,70844,7,70849,70849,7,71090,71093,5,71103,71104,5,71227,71228,7,71339,71339,5,71344,71349,5,71458,71461,5,71727,71735,5,71985,71989,7,71998,71998,5,72002,72002,7,72154,72155,5,72193,72202,5,72251,72254,5,72281,72283,5,72344,72345,5,72766,72766,7,72874,72880,5,72885,72886,5,73023,73029,5,73104,73105,5,73111,73111,5,92912,92916,5,94095,94098,5,113824,113827,4,119142,119142,7,119155,119162,4,119362,119364,5,121476,121476,5,122888,122904,5,123184,123190,5,125252,125258,5,127183,127183,14,127340,127343,14,127377,127386,14,127491,127503,14,127548,127551,14,127744,127756,14,127761,127761,14,127769,127769,14,127773,127774,14,127780,127788,14,127796,127797,14,127820,127823,14,127869,127869,14,127894,127895,14,127902,127903,14,127943,127943,14,127947,127950,14,127972,127972,14,127988,127988,14,127992,127994,14,128009,128011,14,128019,128019,14,128023,128041,14,128064,128064,14,128102,128107,14,128174,128181,14,128238,128238,14,128246,128247,14,128254,128254,14,128264,128264,14,128278,128299,14,128329,128330,14,128348,128359,14,128371,128377,14,128392,128393,14,128401,128404,14,128421,128421,14,128433,128434,14,128450,128452,14,128476,128478,14,128483,128483,14,128495,128495,14,128506,128506,14,128519,128520,14,128528,128528,14,128534,128534,14,128538,128538,14,128540,128542,14,128544,128549,14,128552,128555,14,128557,128557,14,128560,128563,14,128565,128565,14,128567,128576,14,128581,128591,14,128641,128642,14,128646,128646,14,128648,128648,14,128650,128651,14,128653,128653,14,128655,128655,14,128657,128659,14,128661,128661,14,128663,128663,14,128665,128666,14,128674,128674,14,128676,128677,14,128679,128685,14,128690,128690,14,128694,128694,14,128697,128702,14,128704,128704,14,128710,128714,14,128716,128716,14,128720,128720,14,128723,128724,14,128726,128727,14,128733,128735,14,128742,128744,14,128746,128746,14,128749,128751,14,128753,128754,14,128756,128758,14,128761,128761,14,128763,128764,14,128884,128895,14,128992,129003,14,129008,129008,14,129036,129039,14,129114,129119,14,129198,129279,14,129293,129295,14,129305,129310,14,129312,129319,14,129328,129328,14,129331,129338,14,129343,129343,14,129351,129355,14,129357,129359,14,129375,129387,14,129393,129393,14,129395,129398,14,129401,129401,14,129403,129403,14,129408,129412,14,129426,129431,14,129443,129444,14,129451,129453,14,129456,129465,14,129472,129472,14,129475,129482,14,129484,129484,14,129488,129510,14,129536,129647,14,129652,129652,14,129656,129658,14,129661,129663,14,129667,129670,14,129680,129685,14,129705,129708,14,129712,129718,14,129723,129727,14,129731,129733,14,129744,129750,14,129754,129759,14,129768,129775,14,129783,129791,14,917504,917504,4,917506,917535,4,917632,917759,4,918000,921599,4,0,9,4,11,12,4,14,31,4,169,169,14,174,174,14,1155,1159,5,1425,1469,5,1473,1474,5,1479,1479,5,1552,1562,5,1611,1631,5,1750,1756,5,1759,1764,5,1770,1773,5,1809,1809,5,1958,1968,5,2045,2045,5,2075,2083,5,2089,2093,5,2192,2193,1,2250,2273,5,2275,2306,5,2362,2362,5,2364,2364,5,2369,2376,5,2381,2381,5,2385,2391,5,2433,2433,5,2492,2492,5,2495,2496,7,2503,2504,7,2509,2509,5,2530,2531,5,2561,2562,5,2620,2620,5,2625,2626,5,2635,2637,5,2672,2673,5,2689,2690,5,2748,2748,5,2753,2757,5,2761,2761,7,2765,2765,5,2810,2815,5,2818,2819,7,2878,2878,5,2880,2880,7,2887,2888,7,2893,2893,5,2903,2903,5,2946,2946,5,3007,3007,7,3009,3010,7,3018,3020,7,3031,3031,5,3073,3075,7,3132,3132,5,3137,3140,7,3146,3149,5,3170,3171,5,3202,3203,7,3262,3262,7,3264,3265,7,3267,3268,7,3271,3272,7,3276,3277,5,3298,3299,5,3330,3331,7,3390,3390,5,3393,3396,5,3402,3404,7,3406,3406,1,3426,3427,5,3458,3459,7,3535,3535,5,3538,3540,5,3544,3550,7,3570,3571,7,3635,3635,7,3655,3662,5,3763,3763,7,3784,3789,5,3893,3893,5,3897,3897,5,3953,3966,5,3968,3972,5,3981,3991,5,4038,4038,5,4145,4145,7,4153,4154,5,4157,4158,5,4184,4185,5,4209,4212,5,4228,4228,7,4237,4237,5,4352,4447,8,4520,4607,10,5906,5908,5,5938,5939,5,5970,5971,5,6068,6069,5,6071,6077,5,6086,6086,5,6089,6099,5,6155,6157,5,6159,6159,5,6313,6313,5,6435,6438,7,6441,6443,7,6450,6450,5,6457,6459,5,6681,6682,7,6741,6741,7,6743,6743,7,6752,6752,5,6757,6764,5,6771,6780,5,6832,6845,5,6847,6862,5,6916,6916,7,6965,6965,5,6971,6971,7,6973,6977,7,6979,6980,7,7040,7041,5,7073,7073,7,7078,7079,7,7082,7082,7,7142,7142,5,7144,7145,5,7149,7149,5,7151,7153,5,7204,7211,7,7220,7221,7,7376,7378,5,7393,7393,7,7405,7405,5,7415,7415,7,7616,7679,5,8204,8204,5,8206,8207,4,8233,8233,4,8252,8252,14,8288,8292,4,8294,8303,4,8413,8416,5,8418,8420,5,8482,8482,14,8596,8601,14,8986,8987,14,9096,9096,14,9193,9196,14,9199,9199,14,9201,9202,14,9208,9210,14,9642,9643,14,9664,9664,14,9728,9729,14,9732,9732,14,9735,9741,14,9743,9744,14,9746,9746,14,9750,9751,14,9753,9756,14,9758,9759,14,9761,9761,14,9764,9765,14,9767,9769,14,9771,9773,14,9775,9775,14,9784,9785,14,9787,9791,14,9793,9793,14,9795,9799,14,9812,9822,14,9824,9824,14,9827,9827,14,9829,9830,14,9832,9832,14,9851,9851,14,9854,9854,14,9856,9861,14,9874,9874,14,9876,9876,14,9878,9879,14,9881,9881,14,9883,9884,14,9888,9889,14,9895,9895,14,9898,9899,14,9904,9905,14,9917,9918,14,9924,9925,14,9928,9928,14,9934,9934,14,9936,9936,14,9938,9938,14,9940,9940,14,9961,9961,14,9963,9967,14,9970,9971,14,9973,9973,14,9975,9977,14,9979,9980,14,9982,9985,14,9987,9988,14,9992,9996,14,9998,9998,14,10000,10001,14,10004,10004,14,10013,10013,14,10024,10024,14,10052,10052,14,10060,10060,14,10067,10069,14,10083,10083,14,10085,10087,14,10145,10145,14,10175,10175,14,11013,11015,14,11088,11088,14,11503,11505,5,11744,11775,5,12334,12335,5,12349,12349,14,12951,12951,14,42607,42607,5,42612,42621,5,42736,42737,5,43014,43014,5,43043,43044,7,43047,43047,7,43136,43137,7,43204,43205,5,43263,43263,5,43335,43345,5,43360,43388,8,43395,43395,7,43444,43445,7,43450,43451,7,43454,43456,7,43561,43566,5,43569,43570,5,43573,43574,5,43596,43596,5,43644,43644,5,43698,43700,5,43710,43711,5,43755,43755,7,43758,43759,7,43766,43766,5,44005,44005,5,44008,44008,5,44012,44012,7,44032,44032,11,44060,44060,11,44088,44088,11,44116,44116,11,44144,44144,11,44172,44172,11,44200,44200,11,44228,44228,11,44256,44256,11,44284,44284,11,44312,44312,11,44340,44340,11,44368,44368,11,44396,44396,11,44424,44424,11,44452,44452,11,44480,44480,11,44508,44508,11,44536,44536,11,44564,44564,11,44592,44592,11,44620,44620,11,44648,44648,11,44676,44676,11,44704,44704,11,44732,44732,11,44760,44760,11,44788,44788,11,44816,44816,11,44844,44844,11,44872,44872,11,44900,44900,11,44928,44928,11,44956,44956,11,44984,44984,11,45012,45012,11,45040,45040,11,45068,45068,11,45096,45096,11,45124,45124,11,45152,45152,11,45180,45180,11,45208,45208,11,45236,45236,11,45264,45264,11,45292,45292,11,45320,45320,11,45348,45348,11,45376,45376,11,45404,45404,11,45432,45432,11,45460,45460,11,45488,45488,11,45516,45516,11,45544,45544,11,45572,45572,11,45600,45600,11,45628,45628,11,45656,45656,11,45684,45684,11,45712,45712,11,45740,45740,11,45768,45768,11,45796,45796,11,45824,45824,11,45852,45852,11,45880,45880,11,45908,45908,11,45936,45936,11,45964,45964,11,45992,45992,11,46020,46020,11,46048,46048,11,46076,46076,11,46104,46104,11,46132,46132,11,46160,46160,11,46188,46188,11,46216,46216,11,46244,46244,11,46272,46272,11,46300,46300,11,46328,46328,11,46356,46356,11,46384,46384,11,46412,46412,11,46440,46440,11,46468,46468,11,46496,46496,11,46524,46524,11,46552,46552,11,46580,46580,11,46608,46608,11,46636,46636,11,46664,46664,11,46692,46692,11,46720,46720,11,46748,46748,11,46776,46776,11,46804,46804,11,46832,46832,11,46860,46860,11,46888,46888,11,46916,46916,11,46944,46944,11,46972,46972,11,47000,47000,11,47028,47028,11,47056,47056,11,47084,47084,11,47112,47112,11,47140,47140,11,47168,47168,11,47196,47196,11,47224,47224,11,47252,47252,11,47280,47280,11,47308,47308,11,47336,47336,11,47364,47364,11,47392,47392,11,47420,47420,11,47448,47448,11,47476,47476,11,47504,47504,11,47532,47532,11,47560,47560,11,47588,47588,11,47616,47616,11,47644,47644,11,47672,47672,11,47700,47700,11,47728,47728,11,47756,47756,11,47784,47784,11,47812,47812,11,47840,47840,11,47868,47868,11,47896,47896,11,47924,47924,11,47952,47952,11,47980,47980,11,48008,48008,11,48036,48036,11,48064,48064,11,48092,48092,11,48120,48120,11,48148,48148,11,48176,48176,11,48204,48204,11,48232,48232,11,48260,48260,11,48288,48288,11,48316,48316,11,48344,48344,11,48372,48372,11,48400,48400,11,48428,48428,11,48456,48456,11,48484,48484,11,48512,48512,11,48540,48540,11,48568,48568,11,48596,48596,11,48624,48624,11,48652,48652,11,48680,48680,11,48708,48708,11,48736,48736,11,48764,48764,11,48792,48792,11,48820,48820,11,48848,48848,11,48876,48876,11,48904,48904,11,48932,48932,11,48960,48960,11,48988,48988,11,49016,49016,11,49044,49044,11,49072,49072,11,49100,49100,11,49128,49128,11,49156,49156,11,49184,49184,11,49212,49212,11,49240,49240,11,49268,49268,11,49296,49296,11,49324,49324,11,49352,49352,11,49380,49380,11,49408,49408,11,49436,49436,11,49464,49464,11,49492,49492,11,49520,49520,11,49548,49548,11,49576,49576,11,49604,49604,11,49632,49632,11,49660,49660,11,49688,49688,11,49716,49716,11,49744,49744,11,49772,49772,11,49800,49800,11,49828,49828,11,49856,49856,11,49884,49884,11,49912,49912,11,49940,49940,11,49968,49968,11,49996,49996,11,50024,50024,11,50052,50052,11,50080,50080,11,50108,50108,11,50136,50136,11,50164,50164,11,50192,50192,11,50220,50220,11,50248,50248,11,50276,50276,11,50304,50304,11,50332,50332,11,50360,50360,11,50388,50388,11,50416,50416,11,50444,50444,11,50472,50472,11,50500,50500,11,50528,50528,11,50556,50556,11,50584,50584,11,50612,50612,11,50640,50640,11,50668,50668,11,50696,50696,11,50724,50724,11,50752,50752,11,50780,50780,11,50808,50808,11,50836,50836,11,50864,50864,11,50892,50892,11,50920,50920,11,50948,50948,11,50976,50976,11,51004,51004,11,51032,51032,11,51060,51060,11,51088,51088,11,51116,51116,11,51144,51144,11,51172,51172,11,51200,51200,11,51228,51228,11,51256,51256,11,51284,51284,11,51312,51312,11,51340,51340,11,51368,51368,11,51396,51396,11,51424,51424,11,51452,51452,11,51480,51480,11,51508,51508,11,51536,51536,11,51564,51564,11,51592,51592,11,51620,51620,11,51648,51648,11,51676,51676,11,51704,51704,11,51732,51732,11,51760,51760,11,51788,51788,11,51816,51816,11,51844,51844,11,51872,51872,11,51900,51900,11,51928,51928,11,51956,51956,11,51984,51984,11,52012,52012,11,52040,52040,11,52068,52068,11,52096,52096,11,52124,52124,11,52152,52152,11,52180,52180,11,52208,52208,11,52236,52236,11,52264,52264,11,52292,52292,11,52320,52320,11,52348,52348,11,52376,52376,11,52404,52404,11,52432,52432,11,52460,52460,11,52488,52488,11,52516,52516,11,52544,52544,11,52572,52572,11,52600,52600,11,52628,52628,11,52656,52656,11,52684,52684,11,52712,52712,11,52740,52740,11,52768,52768,11,52796,52796,11,52824,52824,11,52852,52852,11,52880,52880,11,52908,52908,11,52936,52936,11,52964,52964,11,52992,52992,11,53020,53020,11,53048,53048,11,53076,53076,11,53104,53104,11,53132,53132,11,53160,53160,11,53188,53188,11,53216,53216,11,53244,53244,11,53272,53272,11,53300,53300,11,53328,53328,11,53356,53356,11,53384,53384,11,53412,53412,11,53440,53440,11,53468,53468,11,53496,53496,11,53524,53524,11,53552,53552,11,53580,53580,11,53608,53608,11,53636,53636,11,53664,53664,11,53692,53692,11,53720,53720,11,53748,53748,11,53776,53776,11,53804,53804,11,53832,53832,11,53860,53860,11,53888,53888,11,53916,53916,11,53944,53944,11,53972,53972,11,54000,54000,11,54028,54028,11,54056,54056,11,54084,54084,11,54112,54112,11,54140,54140,11,54168,54168,11,54196,54196,11,54224,54224,11,54252,54252,11,54280,54280,11,54308,54308,11,54336,54336,11,54364,54364,11,54392,54392,11,54420,54420,11,54448,54448,11,54476,54476,11,54504,54504,11,54532,54532,11,54560,54560,11,54588,54588,11,54616,54616,11,54644,54644,11,54672,54672,11,54700,54700,11,54728,54728,11,54756,54756,11,54784,54784,11,54812,54812,11,54840,54840,11,54868,54868,11,54896,54896,11,54924,54924,11,54952,54952,11,54980,54980,11,55008,55008,11,55036,55036,11,55064,55064,11,55092,55092,11,55120,55120,11,55148,55148,11,55176,55176,11,55216,55238,9,64286,64286,5,65056,65071,5,65438,65439,5,65529,65531,4,66272,66272,5,68097,68099,5,68108,68111,5,68159,68159,5,68900,68903,5,69446,69456,5,69632,69632,7,69634,69634,7,69744,69744,5,69759,69761,5,69808,69810,7,69815,69816,7,69821,69821,1,69837,69837,1,69927,69931,5,69933,69940,5,70003,70003,5,70018,70018,7,70070,70078,5,70082,70083,1,70094,70094,7,70188,70190,7,70194,70195,7,70197,70197,7,70206,70206,5,70368,70370,7,70400,70401,5,70459,70460,5,70463,70463,7,70465,70468,7,70475,70477,7,70498,70499,7,70512,70516,5,70712,70719,5,70722,70724,5,70726,70726,5,70832,70832,5,70835,70840,5,70842,70842,5,70845,70845,5,70847,70848,5,70850,70851,5,71088,71089,7,71096,71099,7,71102,71102,7,71132,71133,5,71219,71226,5,71229,71229,5,71231,71232,5,71340,71340,7,71342,71343,7,71350,71350,7,71453,71455,5,71462,71462,7,71724,71726,7,71736,71736,7,71984,71984,5,71991,71992,7,71997,71997,7,71999,71999,1,72001,72001,1,72003,72003,5,72148,72151,5,72156,72159,7,72164,72164,7,72243,72248,5,72250,72250,1,72263,72263,5,72279,72280,7,72324,72329,1,72343,72343,7,72751,72751,7,72760,72765,5,72767,72767,5,72873,72873,7,72881,72881,7,72884,72884,7,73009,73014,5,73020,73021,5,73030,73030,1,73098,73102,7,73107,73108,7,73110,73110,7,73459,73460,5,78896,78904,4,92976,92982,5,94033,94087,7,94180,94180,5,113821,113822,5,118528,118573,5,119141,119141,5,119143,119145,5,119150,119154,5,119163,119170,5,119210,119213,5,121344,121398,5,121461,121461,5,121499,121503,5,122880,122886,5,122907,122913,5,122918,122922,5,123566,123566,5,125136,125142,5,126976,126979,14,126981,127182,14,127184,127231,14,127279,127279,14,127344,127345,14,127374,127374,14,127405,127461,14,127489,127490,14,127514,127514,14,127538,127546,14,127561,127567,14,127570,127743,14,127757,127758,14,127760,127760,14,127762,127762,14,127766,127768,14,127770,127770,14,127772,127772,14,127775,127776,14,127778,127779,14,127789,127791,14,127794,127795,14,127798,127798,14,127819,127819,14,127824,127824,14,127868,127868,14,127870,127871,14,127892,127893,14,127896,127896,14,127900,127901,14,127904,127940,14,127942,127942,14,127944,127944,14,127946,127946,14,127951,127955,14,127968,127971,14,127973,127984,14,127987,127987,14,127989,127989,14,127991,127991,14,127995,127999,5,128008,128008,14,128012,128014,14,128017,128018,14,128020,128020,14,128022,128022,14,128042,128042,14,128063,128063,14,128065,128065,14,128101,128101,14,128108,128109,14,128173,128173,14,128182,128183,14,128236,128237,14,128239,128239,14,128245,128245,14,128248,128248,14,128253,128253,14,128255,128258,14,128260,128263,14,128265,128265,14,128277,128277,14,128300,128301,14,128326,128328,14,128331,128334,14,128336,128347,14,128360,128366,14,128369,128370,14,128378,128378,14,128391,128391,14,128394,128397,14,128400,128400,14,128405,128406,14,128420,128420,14,128422,128423,14,128425,128432,14,128435,128443,14,128445,128449,14,128453,128464,14,128468,128475,14,128479,128480,14,128482,128482,14,128484,128487,14,128489,128494,14,128496,128498,14,128500,128505,14,128507,128511,14,128513,128518,14,128521,128525,14,128527,128527,14,128529,128529,14,128533,128533,14,128535,128535,14,128537,128537,14]");
	}
	var $t = class et {
		static #e = this.ambiguousCharacterData = new Ht(() => JSON.parse("{\"_common\":[8232,32,8233,32,5760,32,8192,32,8193,32,8194,32,8195,32,8196,32,8197,32,8198,32,8200,32,8201,32,8202,32,8287,32,8199,32,8239,32,2042,95,65101,95,65102,95,65103,95,8208,45,8209,45,8210,45,65112,45,1748,45,8259,45,727,45,8722,45,10134,45,11450,45,1549,44,1643,44,184,44,42233,44,894,59,2307,58,2691,58,1417,58,1795,58,1796,58,5868,58,65072,58,6147,58,6153,58,8282,58,1475,58,760,58,42889,58,8758,58,720,58,42237,58,451,33,11601,33,660,63,577,63,2429,63,5038,63,42731,63,119149,46,8228,46,1793,46,1794,46,42510,46,68176,46,1632,46,1776,46,42232,46,1373,96,65287,96,8219,96,1523,96,8242,96,1370,96,8175,96,65344,96,900,96,8189,96,8125,96,8127,96,8190,96,697,96,884,96,712,96,714,96,715,96,756,96,699,96,701,96,700,96,702,96,42892,96,1497,96,2036,96,2037,96,5194,96,5836,96,94033,96,94034,96,65339,91,10088,40,10098,40,12308,40,64830,40,65341,93,10089,41,10099,41,12309,41,64831,41,10100,123,119060,123,10101,125,65342,94,8270,42,1645,42,8727,42,66335,42,5941,47,8257,47,8725,47,8260,47,9585,47,10187,47,10744,47,119354,47,12755,47,12339,47,11462,47,20031,47,12035,47,65340,92,65128,92,8726,92,10189,92,10741,92,10745,92,119311,92,119355,92,12756,92,20022,92,12034,92,42872,38,708,94,710,94,5869,43,10133,43,66203,43,8249,60,10094,60,706,60,119350,60,5176,60,5810,60,5120,61,11840,61,12448,61,42239,61,8250,62,10095,62,707,62,119351,62,5171,62,94015,62,8275,126,732,126,8128,126,8764,126,65372,124,65293,45,118002,50,120784,50,120794,50,120804,50,120814,50,120824,50,130034,50,42842,50,423,50,1000,50,42564,50,5311,50,42735,50,119302,51,118003,51,120785,51,120795,51,120805,51,120815,51,120825,51,130035,51,42923,51,540,51,439,51,42858,51,11468,51,1248,51,94011,51,71882,51,118004,52,120786,52,120796,52,120806,52,120816,52,120826,52,130036,52,5070,52,71855,52,118005,53,120787,53,120797,53,120807,53,120817,53,120827,53,130037,53,444,53,71867,53,118006,54,120788,54,120798,54,120808,54,120818,54,120828,54,130038,54,11474,54,5102,54,71893,54,119314,55,118007,55,120789,55,120799,55,120809,55,120819,55,120829,55,130039,55,66770,55,71878,55,2819,56,2538,56,2666,56,125131,56,118008,56,120790,56,120800,56,120810,56,120820,56,120830,56,130040,56,547,56,546,56,66330,56,2663,57,2920,57,2541,57,3437,57,118009,57,120791,57,120801,57,120811,57,120821,57,120831,57,130041,57,42862,57,11466,57,71884,57,71852,57,71894,57,9082,97,65345,97,119834,97,119886,97,119938,97,119990,97,120042,97,120094,97,120146,97,120198,97,120250,97,120302,97,120354,97,120406,97,120458,97,593,97,945,97,120514,97,120572,97,120630,97,120688,97,120746,97,65313,65,117974,65,119808,65,119860,65,119912,65,119964,65,120016,65,120068,65,120120,65,120172,65,120224,65,120276,65,120328,65,120380,65,120432,65,913,65,120488,65,120546,65,120604,65,120662,65,120720,65,5034,65,5573,65,42222,65,94016,65,66208,65,119835,98,119887,98,119939,98,119991,98,120043,98,120095,98,120147,98,120199,98,120251,98,120303,98,120355,98,120407,98,120459,98,388,98,5071,98,5234,98,5551,98,65314,66,8492,66,117975,66,119809,66,119861,66,119913,66,120017,66,120069,66,120121,66,120173,66,120225,66,120277,66,120329,66,120381,66,120433,66,42932,66,914,66,120489,66,120547,66,120605,66,120663,66,120721,66,5108,66,5623,66,42192,66,66178,66,66209,66,66305,66,65347,99,8573,99,119836,99,119888,99,119940,99,119992,99,120044,99,120096,99,120148,99,120200,99,120252,99,120304,99,120356,99,120408,99,120460,99,7428,99,1010,99,11429,99,43951,99,66621,99,128844,67,71913,67,71922,67,65315,67,8557,67,8450,67,8493,67,117976,67,119810,67,119862,67,119914,67,119966,67,120018,67,120174,67,120226,67,120278,67,120330,67,120382,67,120434,67,1017,67,11428,67,5087,67,42202,67,66210,67,66306,67,66581,67,66844,67,8574,100,8518,100,119837,100,119889,100,119941,100,119993,100,120045,100,120097,100,120149,100,120201,100,120253,100,120305,100,120357,100,120409,100,120461,100,1281,100,5095,100,5231,100,42194,100,8558,68,8517,68,117977,68,119811,68,119863,68,119915,68,119967,68,120019,68,120071,68,120123,68,120175,68,120227,68,120279,68,120331,68,120383,68,120435,68,5024,68,5598,68,5610,68,42195,68,8494,101,65349,101,8495,101,8519,101,119838,101,119890,101,119942,101,120046,101,120098,101,120150,101,120202,101,120254,101,120306,101,120358,101,120410,101,120462,101,43826,101,1213,101,8959,69,65317,69,8496,69,117978,69,119812,69,119864,69,119916,69,120020,69,120072,69,120124,69,120176,69,120228,69,120280,69,120332,69,120384,69,120436,69,917,69,120492,69,120550,69,120608,69,120666,69,120724,69,11577,69,5036,69,42224,69,71846,69,71854,69,66182,69,119839,102,119891,102,119943,102,119995,102,120047,102,120099,102,120151,102,120203,102,120255,102,120307,102,120359,102,120411,102,120463,102,43829,102,42905,102,383,102,7837,102,1412,102,119315,70,8497,70,117979,70,119813,70,119865,70,119917,70,120021,70,120073,70,120125,70,120177,70,120229,70,120281,70,120333,70,120385,70,120437,70,42904,70,988,70,120778,70,5556,70,42205,70,71874,70,71842,70,66183,70,66213,70,66853,70,65351,103,8458,103,119840,103,119892,103,119944,103,120048,103,120100,103,120152,103,120204,103,120256,103,120308,103,120360,103,120412,103,120464,103,609,103,7555,103,397,103,1409,103,117980,71,119814,71,119866,71,119918,71,119970,71,120022,71,120074,71,120126,71,120178,71,120230,71,120282,71,120334,71,120386,71,120438,71,1292,71,5056,71,5107,71,42198,71,65352,104,8462,104,119841,104,119945,104,119997,104,120049,104,120101,104,120153,104,120205,104,120257,104,120309,104,120361,104,120413,104,120465,104,1211,104,1392,104,5058,104,65320,72,8459,72,8460,72,8461,72,117981,72,119815,72,119867,72,119919,72,120023,72,120179,72,120231,72,120283,72,120335,72,120387,72,120439,72,919,72,120494,72,120552,72,120610,72,120668,72,120726,72,11406,72,5051,72,5500,72,42215,72,66255,72,731,105,9075,105,65353,105,8560,105,8505,105,8520,105,119842,105,119894,105,119946,105,119998,105,120050,105,120102,105,120154,105,120206,105,120258,105,120310,105,120362,105,120414,105,120466,105,120484,105,618,105,617,105,953,105,8126,105,890,105,120522,105,120580,105,120638,105,120696,105,120754,105,1110,105,42567,105,1231,105,43893,105,5029,105,71875,105,65354,106,8521,106,119843,106,119895,106,119947,106,119999,106,120051,106,120103,106,120155,106,120207,106,120259,106,120311,106,120363,106,120415,106,120467,106,1011,106,1112,106,65322,74,117983,74,119817,74,119869,74,119921,74,119973,74,120025,74,120077,74,120129,74,120181,74,120233,74,120285,74,120337,74,120389,74,120441,74,42930,74,895,74,1032,74,5035,74,5261,74,42201,74,119844,107,119896,107,119948,107,120000,107,120052,107,120104,107,120156,107,120208,107,120260,107,120312,107,120364,107,120416,107,120468,107,8490,75,65323,75,117984,75,119818,75,119870,75,119922,75,119974,75,120026,75,120078,75,120130,75,120182,75,120234,75,120286,75,120338,75,120390,75,120442,75,922,75,120497,75,120555,75,120613,75,120671,75,120729,75,11412,75,5094,75,5845,75,42199,75,66840,75,1472,108,8739,73,9213,73,65512,73,1633,108,1777,73,66336,108,125127,108,118001,108,120783,73,120793,73,120803,73,120813,73,120823,73,130033,73,65321,73,8544,73,8464,73,8465,73,117982,108,119816,73,119868,73,119920,73,120024,73,120128,73,120180,73,120232,73,120284,73,120336,73,120388,73,120440,73,65356,108,8572,73,8467,108,119845,108,119897,108,119949,108,120001,108,120053,108,120105,73,120157,73,120209,73,120261,73,120313,73,120365,73,120417,73,120469,73,448,73,120496,73,120554,73,120612,73,120670,73,120728,73,11410,73,1030,73,1216,73,1493,108,1503,108,1575,108,126464,108,126592,108,65166,108,65165,108,1994,108,11599,73,5825,73,42226,73,93992,73,66186,124,66313,124,119338,76,8556,76,8466,76,117985,76,119819,76,119871,76,119923,76,120027,76,120079,76,120131,76,120183,76,120235,76,120287,76,120339,76,120391,76,120443,76,11472,76,5086,76,5290,76,42209,76,93974,76,71843,76,71858,76,66587,76,66854,76,65325,77,8559,77,8499,77,117986,77,119820,77,119872,77,119924,77,120028,77,120080,77,120132,77,120184,77,120236,77,120288,77,120340,77,120392,77,120444,77,924,77,120499,77,120557,77,120615,77,120673,77,120731,77,1018,77,11416,77,5047,77,5616,77,5846,77,42207,77,66224,77,66321,77,119847,110,119899,110,119951,110,120003,110,120055,110,120107,110,120159,110,120211,110,120263,110,120315,110,120367,110,120419,110,120471,110,1400,110,1404,110,65326,78,8469,78,117987,78,119821,78,119873,78,119925,78,119977,78,120029,78,120081,78,120185,78,120237,78,120289,78,120341,78,120393,78,120445,78,925,78,120500,78,120558,78,120616,78,120674,78,120732,78,11418,78,42208,78,66835,78,3074,111,3202,111,3330,111,3458,111,2406,111,2662,111,2790,111,3046,111,3174,111,3302,111,3430,111,3664,111,3792,111,4160,111,1637,111,1781,111,65359,111,8500,111,119848,111,119900,111,119952,111,120056,111,120108,111,120160,111,120212,111,120264,111,120316,111,120368,111,120420,111,120472,111,7439,111,7441,111,43837,111,959,111,120528,111,120586,111,120644,111,120702,111,120760,111,963,111,120532,111,120590,111,120648,111,120706,111,120764,111,11423,111,4351,111,1413,111,1505,111,1607,111,126500,111,126564,111,126596,111,65259,111,65260,111,65258,111,65257,111,1726,111,64428,111,64429,111,64427,111,64426,111,1729,111,64424,111,64425,111,64423,111,64422,111,1749,111,3360,111,4125,111,66794,111,71880,111,71895,111,66604,111,1984,79,2534,79,2918,79,12295,79,70864,79,71904,79,118000,79,120782,79,120792,79,120802,79,120812,79,120822,79,130032,79,65327,79,117988,79,119822,79,119874,79,119926,79,119978,79,120030,79,120082,79,120134,79,120186,79,120238,79,120290,79,120342,79,120394,79,120446,79,927,79,120502,79,120560,79,120618,79,120676,79,120734,79,11422,79,1365,79,11604,79,4816,79,2848,79,66754,79,42227,79,71861,79,66194,79,66219,79,66564,79,66838,79,9076,112,65360,112,119849,112,119901,112,119953,112,120005,112,120057,112,120109,112,120161,112,120213,112,120265,112,120317,112,120369,112,120421,112,120473,112,961,112,120530,112,120544,112,120588,112,120602,112,120646,112,120660,112,120704,112,120718,112,120762,112,120776,112,11427,112,65328,80,8473,80,117989,80,119823,80,119875,80,119927,80,119979,80,120031,80,120083,80,120187,80,120239,80,120291,80,120343,80,120395,80,120447,80,929,80,120504,80,120562,80,120620,80,120678,80,120736,80,11426,80,5090,80,5229,80,42193,80,66197,80,119850,113,119902,113,119954,113,120006,113,120058,113,120110,113,120162,113,120214,113,120266,113,120318,113,120370,113,120422,113,120474,113,1307,113,1379,113,1382,113,8474,81,117990,81,119824,81,119876,81,119928,81,119980,81,120032,81,120084,81,120188,81,120240,81,120292,81,120344,81,120396,81,120448,81,11605,81,119851,114,119903,114,119955,114,120007,114,120059,114,120111,114,120163,114,120215,114,120267,114,120319,114,120371,114,120423,114,120475,114,43847,114,43848,114,7462,114,11397,114,43905,114,119318,82,8475,82,8476,82,8477,82,117991,82,119825,82,119877,82,119929,82,120033,82,120189,82,120241,82,120293,82,120345,82,120397,82,120449,82,422,82,5025,82,5074,82,66740,82,5511,82,42211,82,94005,82,65363,115,119852,115,119904,115,119956,115,120008,115,120060,115,120112,115,120164,115,120216,115,120268,115,120320,115,120372,115,120424,115,120476,115,42801,115,445,115,1109,115,43946,115,71873,115,66632,115,65331,83,117992,83,119826,83,119878,83,119930,83,119982,83,120034,83,120086,83,120138,83,120190,83,120242,83,120294,83,120346,83,120398,83,120450,83,1029,83,1359,83,5077,83,5082,83,42210,83,94010,83,66198,83,66592,83,119853,116,119905,116,119957,116,120009,116,120061,116,120113,116,120165,116,120217,116,120269,116,120321,116,120373,116,120425,116,120477,116,8868,84,10201,84,128872,84,65332,84,117993,84,119827,84,119879,84,119931,84,119983,84,120035,84,120087,84,120139,84,120191,84,120243,84,120295,84,120347,84,120399,84,120451,84,932,84,120507,84,120565,84,120623,84,120681,84,120739,84,11430,84,5026,84,42196,84,93962,84,71868,84,66199,84,66225,84,66325,84,119854,117,119906,117,119958,117,120010,117,120062,117,120114,117,120166,117,120218,117,120270,117,120322,117,120374,117,120426,117,120478,117,42911,117,7452,117,43854,117,43858,117,651,117,965,117,120534,117,120592,117,120650,117,120708,117,120766,117,1405,117,66806,117,71896,117,8746,85,8899,85,117994,85,119828,85,119880,85,119932,85,119984,85,120036,85,120088,85,120140,85,120192,85,120244,85,120296,85,120348,85,120400,85,120452,85,1357,85,4608,85,66766,85,5196,85,42228,85,94018,85,71864,85,8744,118,8897,118,65366,118,8564,118,119855,118,119907,118,119959,118,120011,118,120063,118,120115,118,120167,118,120219,118,120271,118,120323,118,120375,118,120427,118,120479,118,7456,118,957,118,120526,118,120584,118,120642,118,120700,118,120758,118,1141,118,1496,118,71430,118,43945,118,71872,118,119309,86,1639,86,1783,86,8548,86,117995,86,119829,86,119881,86,119933,86,119985,86,120037,86,120089,86,120141,86,120193,86,120245,86,120297,86,120349,86,120401,86,120453,86,1140,86,11576,86,5081,86,5167,86,42719,86,42214,86,93960,86,71840,86,66845,86,623,119,119856,119,119908,119,119960,119,120012,119,120064,119,120116,119,120168,119,120220,119,120272,119,120324,119,120376,119,120428,119,120480,119,7457,119,1121,119,1309,119,1377,119,71434,119,71438,119,71439,119,43907,119,71910,87,71919,87,117996,87,119830,87,119882,87,119934,87,119986,87,120038,87,120090,87,120142,87,120194,87,120246,87,120298,87,120350,87,120402,87,120454,87,1308,87,5043,87,5076,87,42218,87,5742,120,10539,120,10540,120,10799,120,65368,120,8569,120,119857,120,119909,120,119961,120,120013,120,120065,120,120117,120,120169,120,120221,120,120273,120,120325,120,120377,120,120429,120,120481,120,5441,120,5501,120,5741,88,9587,88,66338,88,71916,88,65336,88,8553,88,117997,88,119831,88,119883,88,119935,88,119987,88,120039,88,120091,88,120143,88,120195,88,120247,88,120299,88,120351,88,120403,88,120455,88,42931,88,935,88,120510,88,120568,88,120626,88,120684,88,120742,88,11436,88,11613,88,5815,88,42219,88,66192,88,66228,88,66327,88,66855,88,611,121,7564,121,65369,121,119858,121,119910,121,119962,121,120014,121,120066,121,120118,121,120170,121,120222,121,120274,121,120326,121,120378,121,120430,121,120482,121,655,121,7935,121,43866,121,947,121,8509,121,120516,121,120574,121,120632,121,120690,121,120748,121,1199,121,4327,121,71900,121,65337,89,117998,89,119832,89,119884,89,119936,89,119988,89,120040,89,120092,89,120144,89,120196,89,120248,89,120300,89,120352,89,120404,89,120456,89,933,89,978,89,120508,89,120566,89,120624,89,120682,89,120740,89,11432,89,1198,89,5033,89,5053,89,42220,89,94019,89,71844,89,66226,89,119859,122,119911,122,119963,122,120015,122,120067,122,120119,122,120171,122,120223,122,120275,122,120327,122,120379,122,120431,122,120483,122,7458,122,43923,122,71876,122,71909,90,66293,90,65338,90,8484,90,8488,90,117999,90,119833,90,119885,90,119937,90,119989,90,120041,90,120197,90,120249,90,120301,90,120353,90,120405,90,120457,90,918,90,120493,90,120551,90,120609,90,120667,90,120725,90,5059,90,42204,90,71849,90,65282,34,65283,35,65284,36,65285,37,65286,38,65290,42,65291,43,65294,46,65295,47,65296,48,65298,50,65299,51,65300,52,65301,53,65302,54,65303,55,65304,56,65305,57,65308,60,65309,61,65310,62,65312,64,65316,68,65318,70,65319,71,65324,76,65329,81,65330,82,65333,85,65334,86,65335,87,65343,95,65346,98,65348,100,65350,102,65355,107,65357,109,65358,110,65361,113,65362,114,65364,116,65365,117,65367,119,65370,122,65371,123,65373,125,119846,109],\"_default\":[160,32,8211,45,65374,126,8218,44,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41,65292,44,65297,49,65307,59,65311,63],\"cs\":[65374,126,8218,44,65306,58,65281,33,8216,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41,65292,44,65297,49,65307,59,65311,63],\"de\":[65374,126,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41,65292,44,65297,49,65307,59,65311,63],\"es\":[8211,45,65374,126,8218,44,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41,65292,44,65297,49,65307,59,65311,63],\"fr\":[65374,126,8218,44,65306,58,65281,33,8216,96,8245,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41,65292,44,65297,49,65307,59,65311,63],\"it\":[160,32,8211,45,65374,126,8218,44,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41,65292,44,65297,49,65307,59,65311,63],\"ja\":[8211,45,8218,44,65281,33,8216,96,8245,96,180,96,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65292,44,65297,49,65307,59],\"ko\":[8211,45,65374,126,8218,44,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41,65292,44,65297,49,65307,59,65311,63],\"pl\":[65374,126,65306,58,65281,33,8216,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41,65292,44,65297,49,65307,59,65311,63],\"pt-BR\":[65374,126,8218,44,65306,58,65281,33,8216,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41,65292,44,65297,49,65307,59,65311,63],\"qps-ploc\":[160,32,8211,45,65374,126,8218,44,65306,58,65281,33,8216,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41,65292,44,65297,49,65307,59,65311,63],\"ru\":[65374,126,8218,44,65306,58,65281,33,8216,96,8245,96,180,96,12494,47,305,105,921,73,1009,112,215,120,65288,40,65289,41,65292,44,65297,49,65307,59,65311,63],\"tr\":[160,32,8211,45,65374,126,8218,44,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41,65292,44,65297,49,65307,59,65311,63],\"zh-hans\":[160,32,65374,126,8218,44,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65297,49],\"zh-hant\":[8211,45,65374,126,8218,44,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89]}"));
		static #t = this.cache = new Vs({ getCacheKey: JSON.stringify }, (t) => {
			function n(u) {
				const c = /* @__PURE__ */ new Map();
				for (let m = 0; m < u.length; m += 2) c.set(u[m], u[m + 1]);
				return c;
			}
			function r(u, c) {
				const m = new Map(u);
				for (const [h, d] of c) m.set(h, d);
				return m;
			}
			function s(u, c) {
				if (!u) return c;
				const m = /* @__PURE__ */ new Map();
				for (const [h, d] of u) c.has(h) && m.set(h, d);
				return m;
			}
			const a = this.ambiguousCharacterData.value;
			let l = t.filter((u) => !u.startsWith("_") && Object.hasOwn(a, u));
			l.length === 0 && (l = ["_default"]);
			let o;
			for (const u of l) {
				const c = n(a[u]);
				o = s(o, c);
			}
			return new et(r(n(a._common), o));
		});
		static getInstance(t) {
			return et.cache.get(Array.from(t));
		}
		static #n = this._locales = new Ht(() => Object.keys(et.ambiguousCharacterData.value).filter((t) => !t.startsWith("_")));
		static getLocales() {
			return et._locales.value;
		}
		constructor(t) {
			this.confusableDictionary = t;
		}
		isAmbiguous(t) {
			return this.confusableDictionary.has(t);
		}
		getPrimaryConfusable(t) {
			return this.confusableDictionary.get(t);
		}
		getConfusableCodePoints() {
			return new Set(this.confusableDictionary.keys());
		}
	}, zt = class xt {
		static getRawData() {
			return JSON.parse("{\"_common\":[11,12,13,127,847,1564,4447,4448,6068,6069,6155,6156,6157,6158,7355,7356,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8204,8205,8206,8207,8234,8235,8236,8237,8238,8239,8287,8288,8289,8290,8291,8292,8293,8294,8295,8296,8297,8298,8299,8300,8301,8302,8303,10240,12644,65024,65025,65026,65027,65028,65029,65030,65031,65032,65033,65034,65035,65036,65037,65038,65039,65279,65440,65520,65521,65522,65523,65524,65525,65526,65527,65528,65532,78844,119155,119156,119157,119158,119159,119160,119161,119162,917504,917505,917506,917507,917508,917509,917510,917511,917512,917513,917514,917515,917516,917517,917518,917519,917520,917521,917522,917523,917524,917525,917526,917527,917528,917529,917530,917531,917532,917533,917534,917535,917536,917537,917538,917539,917540,917541,917542,917543,917544,917545,917546,917547,917548,917549,917550,917551,917552,917553,917554,917555,917556,917557,917558,917559,917560,917561,917562,917563,917564,917565,917566,917567,917568,917569,917570,917571,917572,917573,917574,917575,917576,917577,917578,917579,917580,917581,917582,917583,917584,917585,917586,917587,917588,917589,917590,917591,917592,917593,917594,917595,917596,917597,917598,917599,917600,917601,917602,917603,917604,917605,917606,917607,917608,917609,917610,917611,917612,917613,917614,917615,917616,917617,917618,917619,917620,917621,917622,917623,917624,917625,917626,917627,917628,917629,917630,917631,917760,917761,917762,917763,917764,917765,917766,917767,917768,917769,917770,917771,917772,917773,917774,917775,917776,917777,917778,917779,917780,917781,917782,917783,917784,917785,917786,917787,917788,917789,917790,917791,917792,917793,917794,917795,917796,917797,917798,917799,917800,917801,917802,917803,917804,917805,917806,917807,917808,917809,917810,917811,917812,917813,917814,917815,917816,917817,917818,917819,917820,917821,917822,917823,917824,917825,917826,917827,917828,917829,917830,917831,917832,917833,917834,917835,917836,917837,917838,917839,917840,917841,917842,917843,917844,917845,917846,917847,917848,917849,917850,917851,917852,917853,917854,917855,917856,917857,917858,917859,917860,917861,917862,917863,917864,917865,917866,917867,917868,917869,917870,917871,917872,917873,917874,917875,917876,917877,917878,917879,917880,917881,917882,917883,917884,917885,917886,917887,917888,917889,917890,917891,917892,917893,917894,917895,917896,917897,917898,917899,917900,917901,917902,917903,917904,917905,917906,917907,917908,917909,917910,917911,917912,917913,917914,917915,917916,917917,917918,917919,917920,917921,917922,917923,917924,917925,917926,917927,917928,917929,917930,917931,917932,917933,917934,917935,917936,917937,917938,917939,917940,917941,917942,917943,917944,917945,917946,917947,917948,917949,917950,917951,917952,917953,917954,917955,917956,917957,917958,917959,917960,917961,917962,917963,917964,917965,917966,917967,917968,917969,917970,917971,917972,917973,917974,917975,917976,917977,917978,917979,917980,917981,917982,917983,917984,917985,917986,917987,917988,917989,917990,917991,917992,917993,917994,917995,917996,917997,917998,917999],\"cs\":[173,8203,12288],\"de\":[173,8203,12288],\"es\":[8203,12288],\"fr\":[173,8203,12288],\"it\":[160,173,12288],\"ja\":[173],\"ko\":[173,12288],\"pl\":[173,8203,12288],\"pt-BR\":[173,8203,12288],\"qps-ploc\":[160,173,8203,12288],\"ru\":[173,12288],\"tr\":[160,173,8203,12288],\"zh-hans\":[160,173,8203,12288],\"zh-hant\":[173,12288]}");
		}
		static #e = this._data = void 0;
		static getData() {
			return this._data || (this._data = new Set([...Object.values(xt.getRawData())].flat())), this._data;
		}
		static isInvisibleCharacter(t) {
			return xt.getData().has(t);
		}
		static get codePoints() {
			return xt.getData();
		}
	};
	const Ot = "default", Qs = "$initialize";
	var Ys = class {
		constructor(e, t, n, r, s) {
			this.vsWorker = e, this.req = t, this.channel = n, this.method = r, this.args = s, this.type = 0;
		}
	}, F1 = class {
		constructor(e, t, n, r) {
			this.vsWorker = e, this.seq = t, this.res = n, this.err = r, this.type = 1;
		}
	}, Js = class {
		constructor(e, t, n, r, s) {
			this.vsWorker = e, this.req = t, this.channel = n, this.eventName = r, this.arg = s, this.type = 2;
		}
	}, Zs = class {
		constructor(e, t, n) {
			this.vsWorker = e, this.req = t, this.event = n, this.type = 3;
		}
	}, Ks = class {
		constructor(e, t) {
			this.vsWorker = e, this.req = t, this.type = 4;
		}
	}, ei = class {
		constructor(e) {
			this._workerId = -1, this._handler = e, this._lastSentReq = 0, this._pendingReplies = Object.create(null), this._pendingEmitters = /* @__PURE__ */ new Map(), this._pendingEvents = /* @__PURE__ */ new Map();
		}
		setWorkerId(e) {
			this._workerId = e;
		}
		async sendMessage(e, t, n) {
			const r = String(++this._lastSentReq);
			return new Promise((s, a) => {
				this._pendingReplies[r] = {
					resolve: s,
					reject: a
				}, this._send(new Ys(this._workerId, r, e, t, n));
			});
		}
		listen(e, t, n) {
			let r = null;
			const s = new ue({
				onWillAddFirstListener: () => {
					r = String(++this._lastSentReq), this._pendingEmitters.set(r, s), this._send(new Js(this._workerId, r, e, t, n));
				},
				onDidRemoveLastListener: () => {
					this._pendingEmitters.delete(r), this._send(new Ks(this._workerId, r)), r = null;
				}
			});
			return s.event;
		}
		handleMessage(e) {
			!e || !e.vsWorker || this._workerId !== -1 && e.vsWorker !== this._workerId || this._handleMessage(e);
		}
		createProxyToRemoteChannel(e, t) {
			return new Proxy(Object.create(null), { get: (n, r) => (typeof r == "string" && !n[r] && (V1(r) ? n[r] = (s) => this.listen(e, r, s) : I1(r) ? n[r] = this.listen(e, r, void 0) : r.charCodeAt(0) === 36 && (n[r] = async (...s) => (await t?.(), this.sendMessage(e, r, s)))), n[r]) });
		}
		_handleMessage(e) {
			switch (e.type) {
				case 1: return this._handleReplyMessage(e);
				case 0: return this._handleRequestMessage(e);
				case 2: return this._handleSubscribeEventMessage(e);
				case 3: return this._handleEventMessage(e);
				case 4: return this._handleUnsubscribeEventMessage(e);
			}
		}
		_handleReplyMessage(e) {
			if (!this._pendingReplies[e.seq]) {
				console.warn("Got reply to unknown seq");
				return;
			}
			const t = this._pendingReplies[e.seq];
			if (delete this._pendingReplies[e.seq], e.err) {
				let n = e.err;
				if (e.err.$isError) {
					const r = /* @__PURE__ */ new Error();
					r.name = e.err.name, r.message = e.err.message, r.stack = e.err.stack, n = r;
				}
				t.reject(n);
				return;
			}
			t.resolve(e.res);
		}
		_handleRequestMessage(e) {
			const t = e.req;
			this._handler.handleMessage(e.channel, e.method, e.args).then((n) => {
				this._send(new F1(this._workerId, t, n, void 0));
			}, (n) => {
				n.detail instanceof Error && (n.detail = Tt(n.detail)), this._send(new F1(this._workerId, t, void 0, Tt(n)));
			});
		}
		_handleSubscribeEventMessage(e) {
			const t = e.req, n = this._handler.handleEvent(e.channel, e.eventName, e.arg)((r) => {
				this._send(new Zs(this._workerId, t, r));
			});
			this._pendingEvents.set(t, n);
		}
		_handleEventMessage(e) {
			if (!this._pendingEmitters.has(e.req)) {
				console.warn("Got event for unknown req");
				return;
			}
			this._pendingEmitters.get(e.req).fire(e.event);
		}
		_handleUnsubscribeEventMessage(e) {
			if (!this._pendingEvents.has(e.req)) {
				console.warn("Got unsubscribe for unknown req");
				return;
			}
			this._pendingEvents.get(e.req).dispose(), this._pendingEvents.delete(e.req);
		}
		_send(e) {
			const t = [];
			if (e.type === 0) for (let n = 0; n < e.args.length; n++) {
				const r = e.args[n];
				r instanceof ArrayBuffer && t.push(r);
			}
			else e.type === 1 && e.res instanceof ArrayBuffer && t.push(e.res);
			this._handler.sendMessage(e, t);
		}
	};
	function I1(e) {
		return e[0] === "o" && e[1] === "n" && D1(e.charCodeAt(2));
	}
	function V1(e) {
		return /^onDynamic/.test(e) && D1(e.charCodeAt(9));
	}
	var ti = class {
		constructor(e, t) {
			this._localChannels = /* @__PURE__ */ new Map(), this._remoteChannels = /* @__PURE__ */ new Map(), this._protocol = new ei({
				sendMessage: (n, r) => {
					e(n, r);
				},
				handleMessage: (n, r, s) => this._handleMessage(n, r, s),
				handleEvent: (n, r, s) => this._handleEvent(n, r, s)
			}), this.requestHandler = t(this);
		}
		onmessage(e) {
			this._protocol.handleMessage(e);
		}
		_handleMessage(e, t, n) {
			if (e === Ot && t === Qs) return this.initialize(n[0]);
			const r = e === Ot ? this.requestHandler : this._localChannels.get(e);
			if (!r) return Promise.reject(/* @__PURE__ */ new Error(`Missing channel ${e} on worker thread`));
			const s = r[t];
			if (typeof s != "function") return Promise.reject(/* @__PURE__ */ new Error(`Missing method ${t} on worker thread channel ${e}`));
			try {
				return Promise.resolve(s.apply(r, n));
			} catch (a) {
				return Promise.reject(a);
			}
		}
		_handleEvent(e, t, n) {
			const r = e === Ot ? this.requestHandler : this._localChannels.get(e);
			if (!r) throw new Error(`Missing channel ${e} on worker thread`);
			if (V1(t)) {
				const s = r[t];
				if (typeof s != "function") throw new Error(`Missing dynamic event ${t} on request handler.`);
				const a = s.call(r, n);
				if (typeof a != "function") throw new Error(`Missing dynamic event ${t} on request handler.`);
				return a;
			}
			if (I1(t)) {
				const s = r[t];
				if (typeof s != "function") throw new Error(`Missing event ${t} on request handler.`);
				return s;
			}
			throw new Error(`Malformed event name ${t}`);
		}
		getChannel(e) {
			if (!this._remoteChannels.has(e)) {
				const t = this._protocol.createProxyToRemoteChannel(e);
				this._remoteChannels.set(e, t);
			}
			return this._remoteChannels.get(e);
		}
		async initialize(e) {
			this._protocol.setWorkerId(e);
		}
	};
	let B1 = !1;
	function ni(e) {
		if (B1) throw new Error("WebWorker already initialized!");
		B1 = !0;
		const t = new ti((n) => globalThis.postMessage(n), (n) => e(n));
		return globalThis.onmessage = (n) => {
			t.onmessage(n.data);
		}, t;
	}
	var we = class {
		constructor(e, t, n, r) {
			this.originalStart = e, this.originalLength = t, this.modifiedStart = n, this.modifiedLength = r;
		}
		getOriginalEnd() {
			return this.originalStart + this.originalLength;
		}
		getModifiedEnd() {
			return this.modifiedStart + this.modifiedLength;
		}
	};
	const q1 = typeof Buffer < "u";
	new Ht(() => new Uint8Array(256));
	let Gt;
	var ri = class Yr {
		static wrap(t) {
			return q1 && !Buffer.isBuffer(t) && (t = Buffer.from(t.buffer, t.byteOffset, t.byteLength)), new Yr(t);
		}
		constructor(t) {
			this.buffer = t, this.byteLength = this.buffer.byteLength;
		}
		toString() {
			return q1 ? this.buffer.toString() : (Gt || (Gt = new TextDecoder()), Gt.decode(this.buffer));
		}
	};
	const U1 = "0123456789abcdef";
	function si({ buffer: e }) {
		let t = "";
		for (let n = 0; n < e.length; n++) {
			const r = e[n];
			t += U1[r >>> 4], t += U1[r & 15];
		}
		return t;
	}
	function H1(e, t) {
		return (t << 5) - t + e | 0;
	}
	function ii(e, t) {
		t = H1(149417, t);
		for (let n = 0, r = e.length; n < r; n++) t = H1(e.charCodeAt(n), t);
		return t;
	}
	function jt(e, t, n = 32) {
		const r = n - t, s = ~((1 << r) - 1);
		return (e << t | (s & e) >>> r) >>> 0;
	}
	function Oe(e, t = 32) {
		return e instanceof ArrayBuffer ? si(ri.wrap(new Uint8Array(e))) : (e >>> 0).toString(16).padStart(t / 4, "0");
	}
	(class Jr {
		static #e = this._bigBlock32 = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(320));
		constructor() {
			this._h0 = 1732584193, this._h1 = 4023233417, this._h2 = 2562383102, this._h3 = 271733878, this._h4 = 3285377520, this._buff = new Uint8Array(67), this._buffDV = new DataView(this._buff.buffer), this._buffLen = 0, this._totalLen = 0, this._leftoverHighSurrogate = 0, this._finished = !1;
		}
		update(t) {
			const n = t.length;
			if (n === 0) return;
			const r = this._buff;
			let s = this._buffLen, a = this._leftoverHighSurrogate, l, o;
			for (a !== 0 ? (l = a, o = -1, a = 0) : (l = t.charCodeAt(0), o = 0);;) {
				let u = l;
				if (ct(l)) if (o + 1 < n) {
					const c = t.charCodeAt(o + 1);
					Wt(c) ? (o++, u = T1(l, c)) : u = 65533;
				} else {
					a = l;
					break;
				}
				else Wt(l) && (u = 65533);
				if (s = this._push(r, s, u), o++, o < n) l = t.charCodeAt(o);
				else break;
			}
			this._buffLen = s, this._leftoverHighSurrogate = a;
		}
		_push(t, n, r) {
			return r < 128 ? t[n++] = r : r < 2048 ? (t[n++] = 192 | (r & 1984) >>> 6, t[n++] = 128 | (r & 63) >>> 0) : r < 65536 ? (t[n++] = 224 | (r & 61440) >>> 12, t[n++] = 128 | (r & 4032) >>> 6, t[n++] = 128 | (r & 63) >>> 0) : (t[n++] = 240 | (r & 1835008) >>> 18, t[n++] = 128 | (r & 258048) >>> 12, t[n++] = 128 | (r & 4032) >>> 6, t[n++] = 128 | (r & 63) >>> 0), n >= 64 && (this._step(), n -= 64, this._totalLen += 64, t[0] = t[64], t[1] = t[65], t[2] = t[66]), n;
		}
		digest() {
			return this._finished || (this._finished = !0, this._leftoverHighSurrogate && (this._leftoverHighSurrogate = 0, this._buffLen = this._push(this._buff, this._buffLen, 65533)), this._totalLen += this._buffLen, this._wrapUp()), Oe(this._h0) + Oe(this._h1) + Oe(this._h2) + Oe(this._h3) + Oe(this._h4);
		}
		_wrapUp() {
			this._buff[this._buffLen++] = 128, this._buff.subarray(this._buffLen).fill(0), this._buffLen > 56 && (this._step(), this._buff.fill(0));
			const t = 8 * this._totalLen;
			this._buffDV.setUint32(56, Math.floor(t / 4294967296), !1), this._buffDV.setUint32(60, t % 4294967296, !1), this._step();
		}
		_step() {
			const t = Jr._bigBlock32, n = this._buffDV;
			for (let h = 0; h < 64; h += 4) t.setUint32(h, n.getUint32(h, !1), !1);
			for (let h = 64; h < 320; h += 4) t.setUint32(h, jt(t.getUint32(h - 12, !1) ^ t.getUint32(h - 32, !1) ^ t.getUint32(h - 56, !1) ^ t.getUint32(h - 64, !1), 1), !1);
			let r = this._h0, s = this._h1, a = this._h2, l = this._h3, o = this._h4, u, c, m;
			for (let h = 0; h < 80; h++) h < 20 ? (u = s & a | ~s & l, c = 1518500249) : h < 40 ? (u = s ^ a ^ l, c = 1859775393) : h < 60 ? (u = s & a | s & l | a & l, c = 2400959708) : (u = s ^ a ^ l, c = 3395469782), m = jt(r, 5) + u + o + c + t.getUint32(h * 4, !1) & 4294967295, o = l, l = a, a = jt(s, 30), s = r, r = m;
			this._h0 = this._h0 + r & 4294967295, this._h1 = this._h1 + s & 4294967295, this._h2 = this._h2 + a & 4294967295, this._h3 = this._h3 + l & 4294967295, this._h4 = this._h4 + o & 4294967295;
		}
	});
	var W1 = class {
		constructor(e) {
			this.source = e;
		}
		getElements() {
			const e = this.source, t = new Int32Array(e.length);
			for (let n = 0, r = e.length; n < r; n++) t[n] = e.charCodeAt(n);
			return t;
		}
	};
	function ai(e, t, n) {
		return new z1(new W1(e), new W1(t)).ComputeDiff(n).changes;
	}
	var ke = class {
		static Assert(e, t) {
			if (!e) throw new Error(t);
		}
	}, Me = class {
		static Copy(e, t, n, r, s) {
			for (let a = 0; a < s; a++) n[r + a] = e[t + a];
		}
		static Copy2(e, t, n, r, s) {
			for (let a = 0; a < s; a++) n[r + a] = e[t + a];
		}
	}, $1 = class {
		constructor() {
			this.m_changes = [], this.m_originalStart = 1073741824, this.m_modifiedStart = 1073741824, this.m_originalCount = 0, this.m_modifiedCount = 0;
		}
		MarkNextChange() {
			(this.m_originalCount > 0 || this.m_modifiedCount > 0) && this.m_changes.push(new we(this.m_originalStart, this.m_originalCount, this.m_modifiedStart, this.m_modifiedCount)), this.m_originalCount = 0, this.m_modifiedCount = 0, this.m_originalStart = 1073741824, this.m_modifiedStart = 1073741824;
		}
		AddOriginalElement(e, t) {
			this.m_originalStart = Math.min(this.m_originalStart, e), this.m_modifiedStart = Math.min(this.m_modifiedStart, t), this.m_originalCount++;
		}
		AddModifiedElement(e, t) {
			this.m_originalStart = Math.min(this.m_originalStart, e), this.m_modifiedStart = Math.min(this.m_modifiedStart, t), this.m_modifiedCount++;
		}
		getChanges() {
			return (this.m_originalCount > 0 || this.m_modifiedCount > 0) && this.MarkNextChange(), this.m_changes;
		}
		getReverseChanges() {
			return (this.m_originalCount > 0 || this.m_modifiedCount > 0) && this.MarkNextChange(), this.m_changes.reverse(), this.m_changes;
		}
	}, z1 = class Ue {
		constructor(t, n, r = null) {
			this.ContinueProcessingPredicate = r, this._originalSequence = t, this._modifiedSequence = n;
			const [s, a, l] = Ue._getElements(t), [o, u, c] = Ue._getElements(n);
			this._hasStrings = l && c, this._originalStringElements = s, this._originalElementsOrHash = a, this._modifiedStringElements = o, this._modifiedElementsOrHash = u, this.m_forwardHistory = [], this.m_reverseHistory = [];
		}
		static _isStringArray(t) {
			return t.length > 0 && typeof t[0] == "string";
		}
		static _getElements(t) {
			const n = t.getElements();
			if (Ue._isStringArray(n)) {
				const r = new Int32Array(n.length);
				for (let s = 0, a = n.length; s < a; s++) r[s] = ii(n[s], 0);
				return [
					n,
					r,
					!0
				];
			}
			return n instanceof Int32Array ? [
				[],
				n,
				!1
			] : [
				[],
				new Int32Array(n),
				!1
			];
		}
		ElementsAreEqual(t, n) {
			return this._originalElementsOrHash[t] !== this._modifiedElementsOrHash[n] ? !1 : this._hasStrings ? this._originalStringElements[t] === this._modifiedStringElements[n] : !0;
		}
		ElementsAreStrictEqual(t, n) {
			return this.ElementsAreEqual(t, n) ? Ue._getStrictElement(this._originalSequence, t) === Ue._getStrictElement(this._modifiedSequence, n) : !1;
		}
		static _getStrictElement(t, n) {
			return typeof t.getStrictElement == "function" ? t.getStrictElement(n) : null;
		}
		OriginalElementsAreEqual(t, n) {
			return this._originalElementsOrHash[t] !== this._originalElementsOrHash[n] ? !1 : this._hasStrings ? this._originalStringElements[t] === this._originalStringElements[n] : !0;
		}
		ModifiedElementsAreEqual(t, n) {
			return this._modifiedElementsOrHash[t] !== this._modifiedElementsOrHash[n] ? !1 : this._hasStrings ? this._modifiedStringElements[t] === this._modifiedStringElements[n] : !0;
		}
		ComputeDiff(t) {
			return this._ComputeDiff(0, this._originalElementsOrHash.length - 1, 0, this._modifiedElementsOrHash.length - 1, t);
		}
		_ComputeDiff(t, n, r, s, a) {
			const l = [!1];
			let o = this.ComputeDiffRecursive(t, n, r, s, l);
			return a && (o = this.PrettifyChanges(o)), {
				quitEarly: l[0],
				changes: o
			};
		}
		ComputeDiffRecursive(t, n, r, s, a) {
			for (a[0] = !1; t <= n && r <= s && this.ElementsAreEqual(t, r);) t++, r++;
			for (; n >= t && s >= r && this.ElementsAreEqual(n, s);) n--, s--;
			if (t > n || r > s) {
				let h;
				return r <= s ? (ke.Assert(t === n + 1, "originalStart should only be one more than originalEnd"), h = [new we(t, 0, r, s - r + 1)]) : t <= n ? (ke.Assert(r === s + 1, "modifiedStart should only be one more than modifiedEnd"), h = [new we(t, n - t + 1, r, 0)]) : (ke.Assert(t === n + 1, "originalStart should only be one more than originalEnd"), ke.Assert(r === s + 1, "modifiedStart should only be one more than modifiedEnd"), h = []), h;
			}
			const l = [0], o = [0], u = this.ComputeRecursionPoint(t, n, r, s, l, o, a), c = l[0], m = o[0];
			if (u !== null) return u;
			if (!a[0]) {
				const h = this.ComputeDiffRecursive(t, c, r, m, a);
				let d = [];
				return a[0] ? d = [new we(c + 1, n - (c + 1) + 1, m + 1, s - (m + 1) + 1)] : d = this.ComputeDiffRecursive(c + 1, n, m + 1, s, a), this.ConcatenateChanges(h, d);
			}
			return [new we(t, n - t + 1, r, s - r + 1)];
		}
		WALKTRACE(t, n, r, s, a, l, o, u, c, m, h, d, f, b, p, y, v, L) {
			let _ = null, N = null, k = new $1(), M = n, w = r, C = f[0] - y[0] - s, T = -1073741824, U = this.m_forwardHistory.length - 1;
			do {
				const x = C + t;
				x === M || x < w && c[x - 1] < c[x + 1] ? (h = c[x + 1], b = h - C - s, h < T && k.MarkNextChange(), T = h, k.AddModifiedElement(h + 1, b), C = x + 1 - t) : (h = c[x - 1] + 1, b = h - C - s, h < T && k.MarkNextChange(), T = h - 1, k.AddOriginalElement(h, b + 1), C = x - 1 - t), U >= 0 && (c = this.m_forwardHistory[U], t = c[0], M = 1, w = c.length - 1);
			} while (--U >= -1);
			if (_ = k.getReverseChanges(), L[0]) {
				let x = f[0] + 1, R = y[0] + 1;
				if (_ !== null && _.length > 0) {
					const S = _[_.length - 1];
					x = Math.max(x, S.getOriginalEnd()), R = Math.max(R, S.getModifiedEnd());
				}
				N = [new we(x, d - x + 1, R, p - R + 1)];
			} else {
				k = new $1(), M = l, w = o, C = f[0] - y[0] - u, T = 1073741824, U = v ? this.m_reverseHistory.length - 1 : this.m_reverseHistory.length - 2;
				do {
					const x = C + a;
					x === M || x < w && m[x - 1] >= m[x + 1] ? (h = m[x + 1] - 1, b = h - C - u, h > T && k.MarkNextChange(), T = h + 1, k.AddOriginalElement(h + 1, b + 1), C = x + 1 - a) : (h = m[x - 1], b = h - C - u, h > T && k.MarkNextChange(), T = h, k.AddModifiedElement(h + 1, b + 1), C = x - 1 - a), U >= 0 && (m = this.m_reverseHistory[U], a = m[0], M = 1, w = m.length - 1);
				} while (--U >= -1);
				N = k.getChanges();
			}
			return this.ConcatenateChanges(_, N);
		}
		ComputeRecursionPoint(t, n, r, s, a, l, o) {
			let u = 0, c = 0, m = 0, h = 0, d = 0, f = 0;
			t--, r--, a[0] = 0, l[0] = 0, this.m_forwardHistory = [], this.m_reverseHistory = [];
			const b = n - t + (s - r), p = b + 1, y = new Int32Array(p), v = new Int32Array(p), L = s - r, _ = n - t, N = t - r, k = n - s, M = (_ - L) % 2 === 0;
			y[L] = t, v[_] = n, o[0] = !1;
			for (let w = 1; w <= b / 2 + 1; w++) {
				let C = 0, T = 0;
				m = this.ClipDiagonalBound(L - w, w, L, p), h = this.ClipDiagonalBound(L + w, w, L, p);
				for (let x = m; x <= h; x += 2) {
					x === m || x < h && y[x - 1] < y[x + 1] ? u = y[x + 1] : u = y[x - 1] + 1, c = u - (x - L) - N;
					const R = u;
					for (; u < n && c < s && this.ElementsAreEqual(u + 1, c + 1);) u++, c++;
					if (y[x] = u, u + c > C + T && (C = u, T = c), !M && Math.abs(x - _) <= w - 1 && u >= v[x]) return a[0] = u, l[0] = c, R <= v[x] && w <= 1448 ? this.WALKTRACE(L, m, h, N, _, d, f, k, y, v, u, n, a, c, s, l, M, o) : null;
				}
				const U = (C - t + (T - r) - w) / 2;
				if (this.ContinueProcessingPredicate !== null && !this.ContinueProcessingPredicate(C, U)) return o[0] = !0, a[0] = C, l[0] = T, U > 0 && w <= 1448 ? this.WALKTRACE(L, m, h, N, _, d, f, k, y, v, u, n, a, c, s, l, M, o) : (t++, r++, [new we(t, n - t + 1, r, s - r + 1)]);
				d = this.ClipDiagonalBound(_ - w, w, _, p), f = this.ClipDiagonalBound(_ + w, w, _, p);
				for (let x = d; x <= f; x += 2) {
					x === d || x < f && v[x - 1] >= v[x + 1] ? u = v[x + 1] - 1 : u = v[x - 1], c = u - (x - _) - k;
					const R = u;
					for (; u > t && c > r && this.ElementsAreEqual(u, c);) u--, c--;
					if (v[x] = u, M && Math.abs(x - L) <= w && u <= y[x]) return a[0] = u, l[0] = c, R >= y[x] && w <= 1448 ? this.WALKTRACE(L, m, h, N, _, d, f, k, y, v, u, n, a, c, s, l, M, o) : null;
				}
				if (w <= 1447) {
					let x = new Int32Array(h - m + 2);
					x[0] = L - m + 1, Me.Copy2(y, m, x, 1, h - m + 1), this.m_forwardHistory.push(x), x = new Int32Array(f - d + 2), x[0] = _ - d + 1, Me.Copy2(v, d, x, 1, f - d + 1), this.m_reverseHistory.push(x);
				}
			}
			return this.WALKTRACE(L, m, h, N, _, d, f, k, y, v, u, n, a, c, s, l, M, o);
		}
		PrettifyChanges(t) {
			for (let n = 0; n < t.length; n++) {
				const r = t[n], s = n < t.length - 1 ? t[n + 1].originalStart : this._originalElementsOrHash.length, a = n < t.length - 1 ? t[n + 1].modifiedStart : this._modifiedElementsOrHash.length, l = r.originalLength > 0, o = r.modifiedLength > 0;
				for (; r.originalStart + r.originalLength < s && r.modifiedStart + r.modifiedLength < a && (!l || this.OriginalElementsAreEqual(r.originalStart, r.originalStart + r.originalLength)) && (!o || this.ModifiedElementsAreEqual(r.modifiedStart, r.modifiedStart + r.modifiedLength));) {
					const c = this.ElementsAreStrictEqual(r.originalStart, r.modifiedStart);
					if (this.ElementsAreStrictEqual(r.originalStart + r.originalLength, r.modifiedStart + r.modifiedLength) && !c) break;
					r.originalStart++, r.modifiedStart++;
				}
				const u = [null];
				if (n < t.length - 1 && this.ChangesOverlap(t[n], t[n + 1], u)) {
					t[n] = u[0], t.splice(n + 1, 1), n--;
					continue;
				}
			}
			for (let n = t.length - 1; n >= 0; n--) {
				const r = t[n];
				let s = 0, a = 0;
				if (n > 0) {
					const h = t[n - 1];
					s = h.originalStart + h.originalLength, a = h.modifiedStart + h.modifiedLength;
				}
				const l = r.originalLength > 0, o = r.modifiedLength > 0;
				let u = 0, c = this._boundaryScore(r.originalStart, r.originalLength, r.modifiedStart, r.modifiedLength);
				for (let h = 1;; h++) {
					const d = r.originalStart - h, f = r.modifiedStart - h;
					if (d < s || f < a || l && !this.OriginalElementsAreEqual(d, d + r.originalLength) || o && !this.ModifiedElementsAreEqual(f, f + r.modifiedLength)) break;
					const b = (d === s && f === a ? 5 : 0) + this._boundaryScore(d, r.originalLength, f, r.modifiedLength);
					b > c && (c = b, u = h);
				}
				r.originalStart -= u, r.modifiedStart -= u;
				const m = [null];
				if (n > 0 && this.ChangesOverlap(t[n - 1], t[n], m)) {
					t[n - 1] = m[0], t.splice(n, 1), n++;
					continue;
				}
			}
			if (this._hasStrings) for (let n = 1, r = t.length; n < r; n++) {
				const s = t[n - 1], a = t[n], l = a.originalStart - s.originalStart - s.originalLength, o = s.originalStart, u = a.originalStart + a.originalLength, c = u - o, m = s.modifiedStart, h = a.modifiedStart + a.modifiedLength, d = h - m;
				if (l < 5 && c < 20 && d < 20) {
					const f = this._findBetterContiguousSequence(o, c, m, d, l);
					if (f) {
						const [b, p] = f;
						(b !== s.originalStart + s.originalLength || p !== s.modifiedStart + s.modifiedLength) && (s.originalLength = b - s.originalStart, s.modifiedLength = p - s.modifiedStart, a.originalStart = b + l, a.modifiedStart = p + l, a.originalLength = u - a.originalStart, a.modifiedLength = h - a.modifiedStart);
					}
				}
			}
			return t;
		}
		_findBetterContiguousSequence(t, n, r, s, a) {
			if (n < a || s < a) return null;
			const l = t + n - a + 1, o = r + s - a + 1;
			let u = 0, c = 0, m = 0;
			for (let h = t; h < l; h++) for (let d = r; d < o; d++) {
				const f = this._contiguousSequenceScore(h, d, a);
				f > 0 && f > u && (u = f, c = h, m = d);
			}
			return u > 0 ? [c, m] : null;
		}
		_contiguousSequenceScore(t, n, r) {
			let s = 0;
			for (let a = 0; a < r; a++) {
				if (!this.ElementsAreEqual(t + a, n + a)) return 0;
				s += this._originalStringElements[t + a].length;
			}
			return s;
		}
		_OriginalIsBoundary(t) {
			return t <= 0 || t >= this._originalElementsOrHash.length - 1 ? !0 : this._hasStrings && /^\s*$/.test(this._originalStringElements[t]);
		}
		_OriginalRegionIsBoundary(t, n) {
			if (this._OriginalIsBoundary(t) || this._OriginalIsBoundary(t - 1)) return !0;
			if (n > 0) {
				const r = t + n;
				if (this._OriginalIsBoundary(r - 1) || this._OriginalIsBoundary(r)) return !0;
			}
			return !1;
		}
		_ModifiedIsBoundary(t) {
			return t <= 0 || t >= this._modifiedElementsOrHash.length - 1 ? !0 : this._hasStrings && /^\s*$/.test(this._modifiedStringElements[t]);
		}
		_ModifiedRegionIsBoundary(t, n) {
			if (this._ModifiedIsBoundary(t) || this._ModifiedIsBoundary(t - 1)) return !0;
			if (n > 0) {
				const r = t + n;
				if (this._ModifiedIsBoundary(r - 1) || this._ModifiedIsBoundary(r)) return !0;
			}
			return !1;
		}
		_boundaryScore(t, n, r, s) {
			return (this._OriginalRegionIsBoundary(t, n) ? 1 : 0) + (this._ModifiedRegionIsBoundary(r, s) ? 1 : 0);
		}
		ConcatenateChanges(t, n) {
			const r = [];
			if (t.length === 0 || n.length === 0) return n.length > 0 ? n : t;
			if (this.ChangesOverlap(t[t.length - 1], n[0], r)) {
				const s = new Array(t.length + n.length - 1);
				return Me.Copy(t, 0, s, 0, t.length - 1), s[t.length - 1] = r[0], Me.Copy(n, 1, s, t.length, n.length - 1), s;
			} else {
				const s = new Array(t.length + n.length);
				return Me.Copy(t, 0, s, 0, t.length), Me.Copy(n, 0, s, t.length, n.length), s;
			}
		}
		ChangesOverlap(t, n, r) {
			if (ke.Assert(t.originalStart <= n.originalStart, "Left change is not less than or equal to right change"), ke.Assert(t.modifiedStart <= n.modifiedStart, "Left change is not less than or equal to right change"), t.originalStart + t.originalLength >= n.originalStart || t.modifiedStart + t.modifiedLength >= n.modifiedStart) {
				const s = t.originalStart;
				let a = t.originalLength;
				const l = t.modifiedStart;
				let o = t.modifiedLength;
				return t.originalStart + t.originalLength >= n.originalStart && (a = n.originalStart + n.originalLength - t.originalStart), t.modifiedStart + t.modifiedLength >= n.modifiedStart && (o = n.modifiedStart + n.modifiedLength - t.modifiedStart), r[0] = new we(s, a, l, o), !0;
			} else return r[0] = null, !1;
		}
		ClipDiagonalBound(t, n, r, s) {
			if (t >= 0 && t < s) return t;
			const a = r, l = s - r - 1, o = n % 2 === 0;
			return t < 0 ? o === (a % 2 === 0) ? 0 : 1 : o === (l % 2 === 0) ? s - 1 : s - 2;
		}
	}, W = class Ce {
		constructor(t, n) {
			this.lineNumber = t, this.column = n;
		}
		with(t = this.lineNumber, n = this.column) {
			return t === this.lineNumber && n === this.column ? this : new Ce(t, n);
		}
		delta(t = 0, n = 0) {
			return this.with(Math.max(1, this.lineNumber + t), Math.max(1, this.column + n));
		}
		equals(t) {
			return Ce.equals(this, t);
		}
		static equals(t, n) {
			return !t && !n ? !0 : !!t && !!n && t.lineNumber === n.lineNumber && t.column === n.column;
		}
		isBefore(t) {
			return Ce.isBefore(this, t);
		}
		static isBefore(t, n) {
			return t.lineNumber < n.lineNumber ? !0 : n.lineNumber < t.lineNumber ? !1 : t.column < n.column;
		}
		isBeforeOrEqual(t) {
			return Ce.isBeforeOrEqual(this, t);
		}
		static isBeforeOrEqual(t, n) {
			return t.lineNumber < n.lineNumber ? !0 : n.lineNumber < t.lineNumber ? !1 : t.column <= n.column;
		}
		static compare(t, n) {
			const r = t.lineNumber | 0, s = n.lineNumber | 0;
			return r === s ? (t.column | 0) - (n.column | 0) : r - s;
		}
		clone() {
			return new Ce(this.lineNumber, this.column);
		}
		toString() {
			return "(" + this.lineNumber + "," + this.column + ")";
		}
		static lift(t) {
			return new Ce(t.lineNumber, t.column);
		}
		static isIPosition(t) {
			return !!t && typeof t.lineNumber == "number" && typeof t.column == "number";
		}
		toJSON() {
			return {
				lineNumber: this.lineNumber,
				column: this.column
			};
		}
	}, I = class j {
		constructor(t, n, r, s) {
			t > r || t === r && n > s ? (this.startLineNumber = r, this.startColumn = s, this.endLineNumber = t, this.endColumn = n) : (this.startLineNumber = t, this.startColumn = n, this.endLineNumber = r, this.endColumn = s);
		}
		isEmpty() {
			return j.isEmpty(this);
		}
		static isEmpty(t) {
			return t.startLineNumber === t.endLineNumber && t.startColumn === t.endColumn;
		}
		containsPosition(t) {
			return j.containsPosition(this, t);
		}
		static containsPosition(t, n) {
			return !(n.lineNumber < t.startLineNumber || n.lineNumber > t.endLineNumber || n.lineNumber === t.startLineNumber && n.column < t.startColumn || n.lineNumber === t.endLineNumber && n.column > t.endColumn);
		}
		static strictContainsPosition(t, n) {
			return !(n.lineNumber < t.startLineNumber || n.lineNumber > t.endLineNumber || n.lineNumber === t.startLineNumber && n.column <= t.startColumn || n.lineNumber === t.endLineNumber && n.column >= t.endColumn);
		}
		containsRange(t) {
			return j.containsRange(this, t);
		}
		static containsRange(t, n) {
			return !(n.startLineNumber < t.startLineNumber || n.endLineNumber < t.startLineNumber || n.startLineNumber > t.endLineNumber || n.endLineNumber > t.endLineNumber || n.startLineNumber === t.startLineNumber && n.startColumn < t.startColumn || n.endLineNumber === t.endLineNumber && n.endColumn > t.endColumn);
		}
		strictContainsRange(t) {
			return j.strictContainsRange(this, t);
		}
		static strictContainsRange(t, n) {
			return !(n.startLineNumber < t.startLineNumber || n.endLineNumber < t.startLineNumber || n.startLineNumber > t.endLineNumber || n.endLineNumber > t.endLineNumber || n.startLineNumber === t.startLineNumber && n.startColumn <= t.startColumn || n.endLineNumber === t.endLineNumber && n.endColumn >= t.endColumn);
		}
		plusRange(t) {
			return j.plusRange(this, t);
		}
		static plusRange(t, n) {
			let r, s, a, l;
			return n.startLineNumber < t.startLineNumber ? (r = n.startLineNumber, s = n.startColumn) : n.startLineNumber === t.startLineNumber ? (r = n.startLineNumber, s = Math.min(n.startColumn, t.startColumn)) : (r = t.startLineNumber, s = t.startColumn), n.endLineNumber > t.endLineNumber ? (a = n.endLineNumber, l = n.endColumn) : n.endLineNumber === t.endLineNumber ? (a = n.endLineNumber, l = Math.max(n.endColumn, t.endColumn)) : (a = t.endLineNumber, l = t.endColumn), new j(r, s, a, l);
		}
		intersectRanges(t) {
			return j.intersectRanges(this, t);
		}
		static intersectRanges(t, n) {
			let r = t.startLineNumber, s = t.startColumn, a = t.endLineNumber, l = t.endColumn;
			const o = n.startLineNumber, u = n.startColumn, c = n.endLineNumber, m = n.endColumn;
			return r < o ? (r = o, s = u) : r === o && (s = Math.max(s, u)), a > c ? (a = c, l = m) : a === c && (l = Math.min(l, m)), r > a || r === a && s > l ? null : new j(r, s, a, l);
		}
		equalsRange(t) {
			return j.equalsRange(this, t);
		}
		static equalsRange(t, n) {
			return !t && !n ? !0 : !!t && !!n && t.startLineNumber === n.startLineNumber && t.startColumn === n.startColumn && t.endLineNumber === n.endLineNumber && t.endColumn === n.endColumn;
		}
		getEndPosition() {
			return j.getEndPosition(this);
		}
		static getEndPosition(t) {
			return new W(t.endLineNumber, t.endColumn);
		}
		getStartPosition() {
			return j.getStartPosition(this);
		}
		static getStartPosition(t) {
			return new W(t.startLineNumber, t.startColumn);
		}
		toString() {
			return "[" + this.startLineNumber + "," + this.startColumn + " -> " + this.endLineNumber + "," + this.endColumn + "]";
		}
		setEndPosition(t, n) {
			return new j(this.startLineNumber, this.startColumn, t, n);
		}
		setStartPosition(t, n) {
			return new j(t, n, this.endLineNumber, this.endColumn);
		}
		collapseToStart() {
			return j.collapseToStart(this);
		}
		static collapseToStart(t) {
			return new j(t.startLineNumber, t.startColumn, t.startLineNumber, t.startColumn);
		}
		collapseToEnd() {
			return j.collapseToEnd(this);
		}
		static collapseToEnd(t) {
			return new j(t.endLineNumber, t.endColumn, t.endLineNumber, t.endColumn);
		}
		delta(t) {
			return new j(this.startLineNumber + t, this.startColumn, this.endLineNumber + t, this.endColumn);
		}
		isSingleLine() {
			return this.startLineNumber === this.endLineNumber;
		}
		static fromPositions(t, n = t) {
			return new j(t.lineNumber, t.column, n.lineNumber, n.column);
		}
		static lift(t) {
			return t ? new j(t.startLineNumber, t.startColumn, t.endLineNumber, t.endColumn) : null;
		}
		static isIRange(t) {
			return !!t && typeof t.startLineNumber == "number" && typeof t.startColumn == "number" && typeof t.endLineNumber == "number" && typeof t.endColumn == "number";
		}
		static areIntersectingOrTouching(t, n) {
			return !(t.endLineNumber < n.startLineNumber || t.endLineNumber === n.startLineNumber && t.endColumn < n.startColumn || n.endLineNumber < t.startLineNumber || n.endLineNumber === t.startLineNumber && n.endColumn < t.startColumn);
		}
		static areIntersecting(t, n) {
			return !(t.endLineNumber < n.startLineNumber || t.endLineNumber === n.startLineNumber && t.endColumn <= n.startColumn || n.endLineNumber < t.startLineNumber || n.endLineNumber === t.startLineNumber && n.endColumn <= t.startColumn);
		}
		static areOnlyIntersecting(t, n) {
			return !(t.endLineNumber < n.startLineNumber - 1 || t.endLineNumber === n.startLineNumber && t.endColumn < n.startColumn - 1 || n.endLineNumber < t.startLineNumber - 1 || n.endLineNumber === t.startLineNumber && n.endColumn < t.startColumn - 1);
		}
		static compareRangesUsingStarts(t, n) {
			if (t && n) {
				const r = t.startLineNumber | 0, s = n.startLineNumber | 0;
				if (r === s) {
					const a = t.startColumn | 0, l = n.startColumn | 0;
					if (a === l) {
						const o = t.endLineNumber | 0, u = n.endLineNumber | 0;
						return o === u ? (t.endColumn | 0) - (n.endColumn | 0) : o - u;
					}
					return a - l;
				}
				return r - s;
			}
			return (t ? 1 : 0) - (n ? 1 : 0);
		}
		static compareRangesUsingEnds(t, n) {
			return t.endLineNumber === n.endLineNumber ? t.endColumn === n.endColumn ? t.startLineNumber === n.startLineNumber ? t.startColumn - n.startColumn : t.startLineNumber - n.startLineNumber : t.endColumn - n.endColumn : t.endLineNumber - n.endLineNumber;
		}
		static spansMultipleLines(t) {
			return t.endLineNumber > t.startLineNumber;
		}
		toJSON() {
			return this;
		}
	};
	function O1(e) {
		return e < 0 ? 0 : e > 255 ? 255 : e | 0;
	}
	function Ee(e) {
		return e < 0 ? 0 : e > 4294967295 ? 4294967295 : e | 0;
	}
	var li = class Zr {
		constructor(t) {
			const n = O1(t);
			this._defaultValue = n, this._asciiMap = Zr._createAsciiMap(n), this._map = /* @__PURE__ */ new Map();
		}
		static _createAsciiMap(t) {
			const n = new Uint8Array(256);
			return n.fill(t), n;
		}
		set(t, n) {
			const r = O1(n);
			t >= 0 && t < 256 ? this._asciiMap[t] = r : this._map.set(t, r);
		}
		get(t) {
			return t >= 0 && t < 256 ? this._asciiMap[t] : this._map.get(t) || this._defaultValue;
		}
		clear() {
			this._asciiMap.fill(this._defaultValue), this._map.clear();
		}
	}, oi = class {
		constructor(e, t, n) {
			const r = new Uint8Array(e * t);
			for (let s = 0, a = e * t; s < a; s++) r[s] = n;
			this._data = r, this.rows = e, this.cols = t;
		}
		get(e, t) {
			return this._data[e * this.cols + t];
		}
		set(e, t, n) {
			this._data[e * this.cols + t] = n;
		}
	}, ui = class {
		constructor(e) {
			let t = 0, n = 0;
			for (let s = 0, a = e.length; s < a; s++) {
				const [l, o, u] = e[s];
				o > t && (t = o), l > n && (n = l), u > n && (n = u);
			}
			t++, n++;
			const r = new oi(n, t, 0);
			for (let s = 0, a = e.length; s < a; s++) {
				const [l, o, u] = e[s];
				r.set(l, o, u);
			}
			this._states = r, this._maxCharCode = t;
		}
		nextState(e, t) {
			return t < 0 || t >= this._maxCharCode ? 0 : this._states.get(e, t);
		}
	};
	let Xt = null;
	function ci() {
		return Xt === null && (Xt = new ui([
			[
				1,
				104,
				2
			],
			[
				1,
				72,
				2
			],
			[
				1,
				102,
				6
			],
			[
				1,
				70,
				6
			],
			[
				2,
				116,
				3
			],
			[
				2,
				84,
				3
			],
			[
				3,
				116,
				4
			],
			[
				3,
				84,
				4
			],
			[
				4,
				112,
				5
			],
			[
				4,
				80,
				5
			],
			[
				5,
				115,
				9
			],
			[
				5,
				83,
				9
			],
			[
				5,
				58,
				10
			],
			[
				6,
				105,
				7
			],
			[
				6,
				73,
				7
			],
			[
				7,
				108,
				8
			],
			[
				7,
				76,
				8
			],
			[
				8,
				101,
				9
			],
			[
				8,
				69,
				9
			],
			[
				9,
				58,
				10
			],
			[
				10,
				47,
				11
			],
			[
				11,
				47,
				12
			]
		])), Xt;
	}
	let Ge = null;
	function hi() {
		if (Ge === null) {
			Ge = new li(0);
			const e = ` 	<>'"、。｡､，．：；‘〈「『〔（［｛｢｣｝］）〕』」〉’｀～…|`;
			for (let n = 0; n < 36; n++) Ge.set(e.charCodeAt(n), 1);
			const t = ".,;:";
			for (let n = 0; n < 4; n++) Ge.set(t.charCodeAt(n), 2);
		}
		return Ge;
	}
	var mi = class v1 {
		static _createLink(t, n, r, s, a) {
			let l = a - 1;
			do {
				const o = n.charCodeAt(l);
				if (t.get(o) !== 2) break;
				l--;
			} while (l > s);
			if (s > 0) {
				const o = n.charCodeAt(s - 1), u = n.charCodeAt(l);
				(o === 40 && u === 41 || o === 91 && u === 93 || o === 123 && u === 125) && l--;
			}
			return {
				range: {
					startLineNumber: r,
					startColumn: s + 1,
					endLineNumber: r,
					endColumn: l + 2
				},
				url: n.substring(s, l + 1)
			};
		}
		static computeLinks(t, n = ci()) {
			const r = hi(), s = [];
			for (let a = 1, l = t.getLineCount(); a <= l; a++) {
				const o = t.getLineContent(a), u = o.length;
				let c = 0, m = 0, h = 0, d = 1, f = !1, b = !1, p = !1, y = !1;
				for (; c < u;) {
					let v = !1;
					const L = o.charCodeAt(c);
					if (d === 13) {
						let _;
						switch (L) {
							case 40:
								f = !0, _ = 0;
								break;
							case 41:
								_ = f ? 0 : 1;
								break;
							case 91:
								p = !0, b = !0, _ = 0;
								break;
							case 93:
								p = !1, _ = b ? 0 : 1;
								break;
							case 123:
								y = !0, _ = 0;
								break;
							case 125:
								_ = y ? 0 : 1;
								break;
							case 39:
							case 34:
							case 96:
								h === L ? _ = 1 : h === 39 || h === 34 || h === 96 ? _ = 0 : _ = 1;
								break;
							case 42:
								_ = h === 42 ? 1 : 0;
								break;
							case 32:
								_ = p ? 0 : 1;
								break;
							default: _ = r.get(L);
						}
						_ === 1 && (s.push(v1._createLink(r, o, a, m, c)), v = !0);
					} else if (d === 12) {
						let _;
						L === 91 ? (b = !0, _ = 0) : _ = r.get(L), _ === 1 ? v = !0 : d = 13;
					} else d = n.nextState(d, L), d === 0 && (v = !0);
					v && (d = 1, f = !1, b = !1, y = !1, m = c + 1, h = L), c++;
				}
				d === 13 && s.push(v1._createLink(r, o, a, m, u));
			}
			return s;
		}
	};
	function fi(e) {
		return !e || typeof e.getLineCount != "function" || typeof e.getLineContent != "function" ? [] : mi.computeLinks(e);
	}
	var gi = class Kr {
		constructor() {
			this._defaultValueSet = [
				["true", "false"],
				["True", "False"],
				[
					"Private",
					"Public",
					"Friend",
					"ReadOnly",
					"Partial",
					"Protected",
					"WriteOnly"
				],
				[
					"public",
					"protected",
					"private"
				]
			];
		}
		static #e = this.INSTANCE = new Kr();
		navigateValueSet(t, n, r, s, a) {
			if (t && n) {
				const l = this.doNavigateValueSet(n, a);
				if (l) return {
					range: t,
					value: l
				};
			}
			if (r && s) {
				const l = this.doNavigateValueSet(s, a);
				if (l) return {
					range: r,
					value: l
				};
			}
			return null;
		}
		doNavigateValueSet(t, n) {
			const r = this.numberReplace(t, n);
			return r !== null ? r : this.textReplace(t, n);
		}
		numberReplace(t, n) {
			const r = Math.pow(10, t.length - (t.lastIndexOf(".") + 1));
			let s = Number(t);
			const a = parseFloat(t);
			return !isNaN(s) && !isNaN(a) && s === a ? s === 0 && !n ? null : (s = Math.floor(s * r), s += n ? r : -r, String(s / r)) : null;
		}
		textReplace(t, n) {
			return this.valueSetsReplace(this._defaultValueSet, t, n);
		}
		valueSetsReplace(t, n, r) {
			let s = null;
			for (let a = 0, l = t.length; s === null && a < l; a++) s = this.valueSetReplace(t[a], n, r);
			return s;
		}
		valueSetReplace(t, n, r) {
			let s = t.indexOf(n);
			return s >= 0 ? (s += r ? 1 : -1, s < 0 ? s = t.length - 1 : s %= t.length, t[s]) : null;
		}
	};
	const G1 = Object.freeze(function(e, t) {
		const n = setTimeout(e.bind(t), 0);
		return { dispose() {
			clearTimeout(n);
		} };
	});
	var ht;
	(function(e) {
		function t(n) {
			return n === e.None || n === e.Cancelled || n instanceof mt ? !0 : !n || typeof n != "object" ? !1 : typeof n.isCancellationRequested == "boolean" && typeof n.onCancellationRequested == "function";
		}
		e.isCancellationToken = t, e.None = Object.freeze({
			isCancellationRequested: !1,
			onCancellationRequested: Vt.None
		}), e.Cancelled = Object.freeze({
			isCancellationRequested: !0,
			onCancellationRequested: G1
		});
	})(ht || (ht = {}));
	var mt = class {
		constructor() {
			this._isCancelled = !1, this._emitter = null;
		}
		cancel() {
			this._isCancelled || (this._isCancelled = !0, this._emitter && (this._emitter.fire(void 0), this.dispose()));
		}
		get isCancellationRequested() {
			return this._isCancelled;
		}
		get onCancellationRequested() {
			return this._isCancelled ? G1 : (this._emitter || (this._emitter = new ue()), this._emitter.event);
		}
		dispose() {
			this._emitter && (this._emitter.dispose(), this._emitter = null);
		}
	}, di = class {
		constructor(e) {
			this._token = void 0, this._parentListener = void 0, this._parentListener = e && e.onCancellationRequested(this.cancel, this);
		}
		get token() {
			return this._token || (this._token = new mt()), this._token;
		}
		cancel() {
			this._token ? this._token instanceof mt && this._token.cancel() : this._token = ht.Cancelled;
		}
		dispose(e = !1) {
			e && this.cancel(), this._parentListener?.dispose(), this._token ? this._token instanceof mt && this._token.dispose() : this._token = ht.None;
		}
	}, Qt = class {
		constructor() {
			this._keyCodeToStr = [], this._strToKeyCode = Object.create(null);
		}
		define(e, t) {
			this._keyCodeToStr[e] = t, this._strToKeyCode[t.toLowerCase()] = e;
		}
		keyCodeToStr(e) {
			return this._keyCodeToStr[e];
		}
		strToKeyCode(e) {
			return this._strToKeyCode[e.toLowerCase()] || 0;
		}
	};
	const ft = new Qt(), Yt = new Qt(), Jt = new Qt(), pi = new Array(230), bi = Object.create(null), wi = Object.create(null), j1 = [];
	for (let e = 0; e <= 193; e++) j1[e] = -1;
	(function() {
		const t = [
			[
				1,
				0,
				"None",
				0,
				"unknown",
				0,
				"VK_UNKNOWN",
				"",
				""
			],
			[
				1,
				1,
				"Hyper",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				2,
				"Super",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				3,
				"Fn",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				4,
				"FnLock",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				5,
				"Suspend",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				6,
				"Resume",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				7,
				"Turbo",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				8,
				"Sleep",
				0,
				"",
				0,
				"VK_SLEEP",
				"",
				""
			],
			[
				1,
				9,
				"WakeUp",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				0,
				10,
				"KeyA",
				31,
				"A",
				65,
				"VK_A",
				"",
				""
			],
			[
				0,
				11,
				"KeyB",
				32,
				"B",
				66,
				"VK_B",
				"",
				""
			],
			[
				0,
				12,
				"KeyC",
				33,
				"C",
				67,
				"VK_C",
				"",
				""
			],
			[
				0,
				13,
				"KeyD",
				34,
				"D",
				68,
				"VK_D",
				"",
				""
			],
			[
				0,
				14,
				"KeyE",
				35,
				"E",
				69,
				"VK_E",
				"",
				""
			],
			[
				0,
				15,
				"KeyF",
				36,
				"F",
				70,
				"VK_F",
				"",
				""
			],
			[
				0,
				16,
				"KeyG",
				37,
				"G",
				71,
				"VK_G",
				"",
				""
			],
			[
				0,
				17,
				"KeyH",
				38,
				"H",
				72,
				"VK_H",
				"",
				""
			],
			[
				0,
				18,
				"KeyI",
				39,
				"I",
				73,
				"VK_I",
				"",
				""
			],
			[
				0,
				19,
				"KeyJ",
				40,
				"J",
				74,
				"VK_J",
				"",
				""
			],
			[
				0,
				20,
				"KeyK",
				41,
				"K",
				75,
				"VK_K",
				"",
				""
			],
			[
				0,
				21,
				"KeyL",
				42,
				"L",
				76,
				"VK_L",
				"",
				""
			],
			[
				0,
				22,
				"KeyM",
				43,
				"M",
				77,
				"VK_M",
				"",
				""
			],
			[
				0,
				23,
				"KeyN",
				44,
				"N",
				78,
				"VK_N",
				"",
				""
			],
			[
				0,
				24,
				"KeyO",
				45,
				"O",
				79,
				"VK_O",
				"",
				""
			],
			[
				0,
				25,
				"KeyP",
				46,
				"P",
				80,
				"VK_P",
				"",
				""
			],
			[
				0,
				26,
				"KeyQ",
				47,
				"Q",
				81,
				"VK_Q",
				"",
				""
			],
			[
				0,
				27,
				"KeyR",
				48,
				"R",
				82,
				"VK_R",
				"",
				""
			],
			[
				0,
				28,
				"KeyS",
				49,
				"S",
				83,
				"VK_S",
				"",
				""
			],
			[
				0,
				29,
				"KeyT",
				50,
				"T",
				84,
				"VK_T",
				"",
				""
			],
			[
				0,
				30,
				"KeyU",
				51,
				"U",
				85,
				"VK_U",
				"",
				""
			],
			[
				0,
				31,
				"KeyV",
				52,
				"V",
				86,
				"VK_V",
				"",
				""
			],
			[
				0,
				32,
				"KeyW",
				53,
				"W",
				87,
				"VK_W",
				"",
				""
			],
			[
				0,
				33,
				"KeyX",
				54,
				"X",
				88,
				"VK_X",
				"",
				""
			],
			[
				0,
				34,
				"KeyY",
				55,
				"Y",
				89,
				"VK_Y",
				"",
				""
			],
			[
				0,
				35,
				"KeyZ",
				56,
				"Z",
				90,
				"VK_Z",
				"",
				""
			],
			[
				0,
				36,
				"Digit1",
				22,
				"1",
				49,
				"VK_1",
				"",
				""
			],
			[
				0,
				37,
				"Digit2",
				23,
				"2",
				50,
				"VK_2",
				"",
				""
			],
			[
				0,
				38,
				"Digit3",
				24,
				"3",
				51,
				"VK_3",
				"",
				""
			],
			[
				0,
				39,
				"Digit4",
				25,
				"4",
				52,
				"VK_4",
				"",
				""
			],
			[
				0,
				40,
				"Digit5",
				26,
				"5",
				53,
				"VK_5",
				"",
				""
			],
			[
				0,
				41,
				"Digit6",
				27,
				"6",
				54,
				"VK_6",
				"",
				""
			],
			[
				0,
				42,
				"Digit7",
				28,
				"7",
				55,
				"VK_7",
				"",
				""
			],
			[
				0,
				43,
				"Digit8",
				29,
				"8",
				56,
				"VK_8",
				"",
				""
			],
			[
				0,
				44,
				"Digit9",
				30,
				"9",
				57,
				"VK_9",
				"",
				""
			],
			[
				0,
				45,
				"Digit0",
				21,
				"0",
				48,
				"VK_0",
				"",
				""
			],
			[
				1,
				46,
				"Enter",
				3,
				"Enter",
				13,
				"VK_RETURN",
				"",
				""
			],
			[
				1,
				47,
				"Escape",
				9,
				"Escape",
				27,
				"VK_ESCAPE",
				"",
				""
			],
			[
				1,
				48,
				"Backspace",
				1,
				"Backspace",
				8,
				"VK_BACK",
				"",
				""
			],
			[
				1,
				49,
				"Tab",
				2,
				"Tab",
				9,
				"VK_TAB",
				"",
				""
			],
			[
				1,
				50,
				"Space",
				10,
				"Space",
				32,
				"VK_SPACE",
				"",
				""
			],
			[
				0,
				51,
				"Minus",
				88,
				"-",
				189,
				"VK_OEM_MINUS",
				"-",
				"OEM_MINUS"
			],
			[
				0,
				52,
				"Equal",
				86,
				"=",
				187,
				"VK_OEM_PLUS",
				"=",
				"OEM_PLUS"
			],
			[
				0,
				53,
				"BracketLeft",
				92,
				"[",
				219,
				"VK_OEM_4",
				"[",
				"OEM_4"
			],
			[
				0,
				54,
				"BracketRight",
				94,
				"]",
				221,
				"VK_OEM_6",
				"]",
				"OEM_6"
			],
			[
				0,
				55,
				"Backslash",
				93,
				"\\",
				220,
				"VK_OEM_5",
				"\\",
				"OEM_5"
			],
			[
				0,
				56,
				"IntlHash",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				0,
				57,
				"Semicolon",
				85,
				";",
				186,
				"VK_OEM_1",
				";",
				"OEM_1"
			],
			[
				0,
				58,
				"Quote",
				95,
				"'",
				222,
				"VK_OEM_7",
				"'",
				"OEM_7"
			],
			[
				0,
				59,
				"Backquote",
				91,
				"`",
				192,
				"VK_OEM_3",
				"`",
				"OEM_3"
			],
			[
				0,
				60,
				"Comma",
				87,
				",",
				188,
				"VK_OEM_COMMA",
				",",
				"OEM_COMMA"
			],
			[
				0,
				61,
				"Period",
				89,
				".",
				190,
				"VK_OEM_PERIOD",
				".",
				"OEM_PERIOD"
			],
			[
				0,
				62,
				"Slash",
				90,
				"/",
				191,
				"VK_OEM_2",
				"/",
				"OEM_2"
			],
			[
				1,
				63,
				"CapsLock",
				8,
				"CapsLock",
				20,
				"VK_CAPITAL",
				"",
				""
			],
			[
				1,
				64,
				"F1",
				59,
				"F1",
				112,
				"VK_F1",
				"",
				""
			],
			[
				1,
				65,
				"F2",
				60,
				"F2",
				113,
				"VK_F2",
				"",
				""
			],
			[
				1,
				66,
				"F3",
				61,
				"F3",
				114,
				"VK_F3",
				"",
				""
			],
			[
				1,
				67,
				"F4",
				62,
				"F4",
				115,
				"VK_F4",
				"",
				""
			],
			[
				1,
				68,
				"F5",
				63,
				"F5",
				116,
				"VK_F5",
				"",
				""
			],
			[
				1,
				69,
				"F6",
				64,
				"F6",
				117,
				"VK_F6",
				"",
				""
			],
			[
				1,
				70,
				"F7",
				65,
				"F7",
				118,
				"VK_F7",
				"",
				""
			],
			[
				1,
				71,
				"F8",
				66,
				"F8",
				119,
				"VK_F8",
				"",
				""
			],
			[
				1,
				72,
				"F9",
				67,
				"F9",
				120,
				"VK_F9",
				"",
				""
			],
			[
				1,
				73,
				"F10",
				68,
				"F10",
				121,
				"VK_F10",
				"",
				""
			],
			[
				1,
				74,
				"F11",
				69,
				"F11",
				122,
				"VK_F11",
				"",
				""
			],
			[
				1,
				75,
				"F12",
				70,
				"F12",
				123,
				"VK_F12",
				"",
				""
			],
			[
				1,
				76,
				"PrintScreen",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				77,
				"ScrollLock",
				84,
				"ScrollLock",
				145,
				"VK_SCROLL",
				"",
				""
			],
			[
				1,
				78,
				"Pause",
				7,
				"PauseBreak",
				19,
				"VK_PAUSE",
				"",
				""
			],
			[
				1,
				79,
				"Insert",
				19,
				"Insert",
				45,
				"VK_INSERT",
				"",
				""
			],
			[
				1,
				80,
				"Home",
				14,
				"Home",
				36,
				"VK_HOME",
				"",
				""
			],
			[
				1,
				81,
				"PageUp",
				11,
				"PageUp",
				33,
				"VK_PRIOR",
				"",
				""
			],
			[
				1,
				82,
				"Delete",
				20,
				"Delete",
				46,
				"VK_DELETE",
				"",
				""
			],
			[
				1,
				83,
				"End",
				13,
				"End",
				35,
				"VK_END",
				"",
				""
			],
			[
				1,
				84,
				"PageDown",
				12,
				"PageDown",
				34,
				"VK_NEXT",
				"",
				""
			],
			[
				1,
				85,
				"ArrowRight",
				17,
				"RightArrow",
				39,
				"VK_RIGHT",
				"Right",
				""
			],
			[
				1,
				86,
				"ArrowLeft",
				15,
				"LeftArrow",
				37,
				"VK_LEFT",
				"Left",
				""
			],
			[
				1,
				87,
				"ArrowDown",
				18,
				"DownArrow",
				40,
				"VK_DOWN",
				"Down",
				""
			],
			[
				1,
				88,
				"ArrowUp",
				16,
				"UpArrow",
				38,
				"VK_UP",
				"Up",
				""
			],
			[
				1,
				89,
				"NumLock",
				83,
				"NumLock",
				144,
				"VK_NUMLOCK",
				"",
				""
			],
			[
				1,
				90,
				"NumpadDivide",
				113,
				"NumPad_Divide",
				111,
				"VK_DIVIDE",
				"",
				""
			],
			[
				1,
				91,
				"NumpadMultiply",
				108,
				"NumPad_Multiply",
				106,
				"VK_MULTIPLY",
				"",
				""
			],
			[
				1,
				92,
				"NumpadSubtract",
				111,
				"NumPad_Subtract",
				109,
				"VK_SUBTRACT",
				"",
				""
			],
			[
				1,
				93,
				"NumpadAdd",
				109,
				"NumPad_Add",
				107,
				"VK_ADD",
				"",
				""
			],
			[
				1,
				94,
				"NumpadEnter",
				3,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				95,
				"Numpad1",
				99,
				"NumPad1",
				97,
				"VK_NUMPAD1",
				"",
				""
			],
			[
				1,
				96,
				"Numpad2",
				100,
				"NumPad2",
				98,
				"VK_NUMPAD2",
				"",
				""
			],
			[
				1,
				97,
				"Numpad3",
				101,
				"NumPad3",
				99,
				"VK_NUMPAD3",
				"",
				""
			],
			[
				1,
				98,
				"Numpad4",
				102,
				"NumPad4",
				100,
				"VK_NUMPAD4",
				"",
				""
			],
			[
				1,
				99,
				"Numpad5",
				103,
				"NumPad5",
				101,
				"VK_NUMPAD5",
				"",
				""
			],
			[
				1,
				100,
				"Numpad6",
				104,
				"NumPad6",
				102,
				"VK_NUMPAD6",
				"",
				""
			],
			[
				1,
				101,
				"Numpad7",
				105,
				"NumPad7",
				103,
				"VK_NUMPAD7",
				"",
				""
			],
			[
				1,
				102,
				"Numpad8",
				106,
				"NumPad8",
				104,
				"VK_NUMPAD8",
				"",
				""
			],
			[
				1,
				103,
				"Numpad9",
				107,
				"NumPad9",
				105,
				"VK_NUMPAD9",
				"",
				""
			],
			[
				1,
				104,
				"Numpad0",
				98,
				"NumPad0",
				96,
				"VK_NUMPAD0",
				"",
				""
			],
			[
				1,
				105,
				"NumpadDecimal",
				112,
				"NumPad_Decimal",
				110,
				"VK_DECIMAL",
				"",
				""
			],
			[
				0,
				106,
				"IntlBackslash",
				97,
				"OEM_102",
				226,
				"VK_OEM_102",
				"",
				""
			],
			[
				1,
				107,
				"ContextMenu",
				58,
				"ContextMenu",
				93,
				"",
				"",
				""
			],
			[
				1,
				108,
				"Power",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				109,
				"NumpadEqual",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				110,
				"F13",
				71,
				"F13",
				124,
				"VK_F13",
				"",
				""
			],
			[
				1,
				111,
				"F14",
				72,
				"F14",
				125,
				"VK_F14",
				"",
				""
			],
			[
				1,
				112,
				"F15",
				73,
				"F15",
				126,
				"VK_F15",
				"",
				""
			],
			[
				1,
				113,
				"F16",
				74,
				"F16",
				127,
				"VK_F16",
				"",
				""
			],
			[
				1,
				114,
				"F17",
				75,
				"F17",
				128,
				"VK_F17",
				"",
				""
			],
			[
				1,
				115,
				"F18",
				76,
				"F18",
				129,
				"VK_F18",
				"",
				""
			],
			[
				1,
				116,
				"F19",
				77,
				"F19",
				130,
				"VK_F19",
				"",
				""
			],
			[
				1,
				117,
				"F20",
				78,
				"F20",
				131,
				"VK_F20",
				"",
				""
			],
			[
				1,
				118,
				"F21",
				79,
				"F21",
				132,
				"VK_F21",
				"",
				""
			],
			[
				1,
				119,
				"F22",
				80,
				"F22",
				133,
				"VK_F22",
				"",
				""
			],
			[
				1,
				120,
				"F23",
				81,
				"F23",
				134,
				"VK_F23",
				"",
				""
			],
			[
				1,
				121,
				"F24",
				82,
				"F24",
				135,
				"VK_F24",
				"",
				""
			],
			[
				1,
				122,
				"Open",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				123,
				"Help",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				124,
				"Select",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				125,
				"Again",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				126,
				"Undo",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				127,
				"Cut",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				128,
				"Copy",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				129,
				"Paste",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				130,
				"Find",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				131,
				"AudioVolumeMute",
				117,
				"AudioVolumeMute",
				173,
				"VK_VOLUME_MUTE",
				"",
				""
			],
			[
				1,
				132,
				"AudioVolumeUp",
				118,
				"AudioVolumeUp",
				175,
				"VK_VOLUME_UP",
				"",
				""
			],
			[
				1,
				133,
				"AudioVolumeDown",
				119,
				"AudioVolumeDown",
				174,
				"VK_VOLUME_DOWN",
				"",
				""
			],
			[
				1,
				134,
				"NumpadComma",
				110,
				"NumPad_Separator",
				108,
				"VK_SEPARATOR",
				"",
				""
			],
			[
				0,
				135,
				"IntlRo",
				115,
				"ABNT_C1",
				193,
				"VK_ABNT_C1",
				"",
				""
			],
			[
				1,
				136,
				"KanaMode",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				0,
				137,
				"IntlYen",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				138,
				"Convert",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				139,
				"NonConvert",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				140,
				"Lang1",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				141,
				"Lang2",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				142,
				"Lang3",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				143,
				"Lang4",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				144,
				"Lang5",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				145,
				"Abort",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				146,
				"Props",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				147,
				"NumpadParenLeft",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				148,
				"NumpadParenRight",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				149,
				"NumpadBackspace",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				150,
				"NumpadMemoryStore",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				151,
				"NumpadMemoryRecall",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				152,
				"NumpadMemoryClear",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				153,
				"NumpadMemoryAdd",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				154,
				"NumpadMemorySubtract",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				155,
				"NumpadClear",
				131,
				"Clear",
				12,
				"VK_CLEAR",
				"",
				""
			],
			[
				1,
				156,
				"NumpadClearEntry",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				0,
				"",
				5,
				"Ctrl",
				17,
				"VK_CONTROL",
				"",
				""
			],
			[
				1,
				0,
				"",
				4,
				"Shift",
				16,
				"VK_SHIFT",
				"",
				""
			],
			[
				1,
				0,
				"",
				6,
				"Alt",
				18,
				"VK_MENU",
				"",
				""
			],
			[
				1,
				0,
				"",
				57,
				"Meta",
				91,
				"VK_COMMAND",
				"",
				""
			],
			[
				1,
				157,
				"ControlLeft",
				5,
				"",
				0,
				"VK_LCONTROL",
				"",
				""
			],
			[
				1,
				158,
				"ShiftLeft",
				4,
				"",
				0,
				"VK_LSHIFT",
				"",
				""
			],
			[
				1,
				159,
				"AltLeft",
				6,
				"",
				0,
				"VK_LMENU",
				"",
				""
			],
			[
				1,
				160,
				"MetaLeft",
				57,
				"",
				0,
				"VK_LWIN",
				"",
				""
			],
			[
				1,
				161,
				"ControlRight",
				5,
				"",
				0,
				"VK_RCONTROL",
				"",
				""
			],
			[
				1,
				162,
				"ShiftRight",
				4,
				"",
				0,
				"VK_RSHIFT",
				"",
				""
			],
			[
				1,
				163,
				"AltRight",
				6,
				"",
				0,
				"VK_RMENU",
				"",
				""
			],
			[
				1,
				164,
				"MetaRight",
				57,
				"",
				0,
				"VK_RWIN",
				"",
				""
			],
			[
				1,
				165,
				"BrightnessUp",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				166,
				"BrightnessDown",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				167,
				"MediaPlay",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				168,
				"MediaRecord",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				169,
				"MediaFastForward",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				170,
				"MediaRewind",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				171,
				"MediaTrackNext",
				124,
				"MediaTrackNext",
				176,
				"VK_MEDIA_NEXT_TRACK",
				"",
				""
			],
			[
				1,
				172,
				"MediaTrackPrevious",
				125,
				"MediaTrackPrevious",
				177,
				"VK_MEDIA_PREV_TRACK",
				"",
				""
			],
			[
				1,
				173,
				"MediaStop",
				126,
				"MediaStop",
				178,
				"VK_MEDIA_STOP",
				"",
				""
			],
			[
				1,
				174,
				"Eject",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				175,
				"MediaPlayPause",
				127,
				"MediaPlayPause",
				179,
				"VK_MEDIA_PLAY_PAUSE",
				"",
				""
			],
			[
				1,
				176,
				"MediaSelect",
				128,
				"LaunchMediaPlayer",
				181,
				"VK_MEDIA_LAUNCH_MEDIA_SELECT",
				"",
				""
			],
			[
				1,
				177,
				"LaunchMail",
				129,
				"LaunchMail",
				180,
				"VK_MEDIA_LAUNCH_MAIL",
				"",
				""
			],
			[
				1,
				178,
				"LaunchApp2",
				130,
				"LaunchApp2",
				183,
				"VK_MEDIA_LAUNCH_APP2",
				"",
				""
			],
			[
				1,
				179,
				"LaunchApp1",
				0,
				"",
				0,
				"VK_MEDIA_LAUNCH_APP1",
				"",
				""
			],
			[
				1,
				180,
				"SelectTask",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				181,
				"LaunchScreenSaver",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				182,
				"BrowserSearch",
				120,
				"BrowserSearch",
				170,
				"VK_BROWSER_SEARCH",
				"",
				""
			],
			[
				1,
				183,
				"BrowserHome",
				121,
				"BrowserHome",
				172,
				"VK_BROWSER_HOME",
				"",
				""
			],
			[
				1,
				184,
				"BrowserBack",
				122,
				"BrowserBack",
				166,
				"VK_BROWSER_BACK",
				"",
				""
			],
			[
				1,
				185,
				"BrowserForward",
				123,
				"BrowserForward",
				167,
				"VK_BROWSER_FORWARD",
				"",
				""
			],
			[
				1,
				186,
				"BrowserStop",
				0,
				"",
				0,
				"VK_BROWSER_STOP",
				"",
				""
			],
			[
				1,
				187,
				"BrowserRefresh",
				0,
				"",
				0,
				"VK_BROWSER_REFRESH",
				"",
				""
			],
			[
				1,
				188,
				"BrowserFavorites",
				0,
				"",
				0,
				"VK_BROWSER_FAVORITES",
				"",
				""
			],
			[
				1,
				189,
				"ZoomToggle",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				190,
				"MailReply",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				191,
				"MailForward",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				192,
				"MailSend",
				0,
				"",
				0,
				"",
				"",
				""
			],
			[
				1,
				0,
				"",
				114,
				"KeyInComposition",
				229,
				"",
				"",
				""
			],
			[
				1,
				0,
				"",
				116,
				"ABNT_C2",
				194,
				"VK_ABNT_C2",
				"",
				""
			],
			[
				1,
				0,
				"",
				96,
				"OEM_8",
				223,
				"VK_OEM_8",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_KANA",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_HANGUL",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_JUNJA",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_FINAL",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_HANJA",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_KANJI",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_CONVERT",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_NONCONVERT",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_ACCEPT",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_MODECHANGE",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_SELECT",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_PRINT",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_EXECUTE",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_SNAPSHOT",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_HELP",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_APPS",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_PROCESSKEY",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_PACKET",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_DBE_SBCSCHAR",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_DBE_DBCSCHAR",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_ATTN",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_CRSEL",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_EXSEL",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_EREOF",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_PLAY",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_ZOOM",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_NONAME",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_PA1",
				"",
				""
			],
			[
				1,
				0,
				"",
				0,
				"",
				0,
				"VK_OEM_CLEAR",
				"",
				""
			]
		], n = [], r = [];
		for (const s of t) {
			const [a, l, o, u, c, m, h, d, f] = s;
			if (r[l] || (r[l] = !0, bi[o] = l, wi[o.toLowerCase()] = l, a && (j1[l] = u)), !n[u]) {
				if (n[u] = !0, !c) throw new Error(`String representation missing for key code ${u} around scan code ${o}`);
				ft.define(u, c), Yt.define(u, d || c), Jt.define(u, f || d || c);
			}
			m && (pi[m] = u);
		}
	})();
	var X1;
	(function(e) {
		function t(o) {
			return ft.keyCodeToStr(o);
		}
		e.toString = t;
		function n(o) {
			return ft.strToKeyCode(o);
		}
		e.fromString = n;
		function r(o) {
			return Yt.keyCodeToStr(o);
		}
		e.toUserSettingsUS = r;
		function s(o) {
			return Jt.keyCodeToStr(o);
		}
		e.toUserSettingsGeneral = s;
		function a(o) {
			return Yt.strToKeyCode(o) || Jt.strToKeyCode(o);
		}
		e.fromUserSettings = a;
		function l(o) {
			if (o >= 98 && o <= 113) return null;
			switch (o) {
				case 16: return "Up";
				case 18: return "Down";
				case 15: return "Left";
				case 17: return "Right";
			}
			return ft.keyCodeToStr(o);
		}
		e.toElectronAccelerator = l;
	})(X1 || (X1 = {}));
	function yi(e, t) {
		return (e | (t & 65535) << 16 >>> 0) >>> 0;
	}
	let Pe;
	const Zt = globalThis.vscode;
	if (typeof Zt < "u" && typeof Zt.process < "u") {
		const e = Zt.process;
		Pe = {
			get platform() {
				return e.platform;
			},
			get arch() {
				return e.arch;
			},
			get env() {
				return e.env;
			},
			cwd() {
				return e.cwd();
			}
		};
	} else typeof process < "u" && typeof process?.versions?.node == "string" ? Pe = {
		get platform() {
			return process.platform;
		},
		get arch() {
			return process.arch;
		},
		get env() {
			return {};
		},
		cwd() {
			return {}.VSCODE_CWD || process.cwd();
		}
	} : Pe = {
		get platform() {
			return ze ? "win32" : Ps ? "darwin" : "linux";
		},
		get arch() {},
		get env() {
			return {};
		},
		cwd() {
			return "/";
		}
	};
	const gt = Pe.cwd, _i = Pe.env, vi = Pe.platform, Li = 65, Ni = 97, Si = 90, Ri = 122, Ne = 46, Q = 47, te = 92, fe = 58, Ai = 63;
	var Q1 = class extends Error {
		constructor(e, t, n) {
			let r;
			typeof t == "string" && t.indexOf("not ") === 0 ? (r = "must not be", t = t.replace(/^not /, "")) : r = "must be";
			let s = `The "${e}" ${e.indexOf(".") !== -1 ? "property" : "argument"} ${r} of type ${t}`;
			s += `. Received type ${typeof n}`, super(s), this.code = "ERR_INVALID_ARG_TYPE";
		}
	};
	function Ci(e, t) {
		if (e === null || typeof e != "object") throw new Q1(t, "Object", e);
	}
	function G(e, t) {
		if (typeof e != "string") throw new Q1(t, "string", e);
	}
	const ye = vi === "win32";
	function V(e) {
		return e === Q || e === te;
	}
	function Kt(e) {
		return e === Q;
	}
	function ge(e) {
		return e >= Li && e <= Si || e >= Ni && e <= Ri;
	}
	function dt(e, t, n, r) {
		let s = "", a = 0, l = -1, o = 0, u = 0;
		for (let c = 0; c <= e.length; ++c) {
			if (c < e.length) u = e.charCodeAt(c);
			else {
				if (r(u)) break;
				u = Q;
			}
			if (r(u)) {
				if (!(l === c - 1 || o === 1)) if (o === 2) {
					if (s.length < 2 || a !== 2 || s.charCodeAt(s.length - 1) !== Ne || s.charCodeAt(s.length - 2) !== Ne) {
						if (s.length > 2) {
							const m = s.lastIndexOf(n);
							m === -1 ? (s = "", a = 0) : (s = s.slice(0, m), a = s.length - 1 - s.lastIndexOf(n)), l = c, o = 0;
							continue;
						} else if (s.length !== 0) {
							s = "", a = 0, l = c, o = 0;
							continue;
						}
					}
					t && (s += s.length > 0 ? `${n}..` : "..", a = 2);
				} else s.length > 0 ? s += `${n}${e.slice(l + 1, c)}` : s = e.slice(l + 1, c), a = c - l - 1;
				l = c, o = 0;
			} else u === Ne && o !== -1 ? ++o : o = -1;
		}
		return s;
	}
	function xi(e) {
		return e ? `${e[0] === "." ? "" : "."}${e}` : "";
	}
	function Y1(e, t) {
		Ci(t, "pathObject");
		const n = t.dir || t.root, r = t.base || `${t.name || ""}${xi(t.ext)}`;
		return n ? n === t.root ? `${n}${r}` : `${n}${e}${r}` : r;
	}
	const K = {
		resolve(...e) {
			let t = "", n = "", r = !1;
			for (let s = e.length - 1; s >= -1; s--) {
				let a;
				if (s >= 0) {
					if (a = e[s], G(a, `paths[${s}]`), a.length === 0) continue;
				} else t.length === 0 ? a = gt() : (a = _i[`=${t}`] || gt(), (a === void 0 || a.slice(0, 2).toLowerCase() !== t.toLowerCase() && a.charCodeAt(2) === te) && (a = `${t}\\`));
				const l = a.length;
				let o = 0, u = "", c = !1;
				const m = a.charCodeAt(0);
				if (l === 1) V(m) && (o = 1, c = !0);
				else if (V(m)) if (c = !0, V(a.charCodeAt(1))) {
					let h = 2, d = h;
					for (; h < l && !V(a.charCodeAt(h));) h++;
					if (h < l && h !== d) {
						const f = a.slice(d, h);
						for (d = h; h < l && V(a.charCodeAt(h));) h++;
						if (h < l && h !== d) {
							for (d = h; h < l && !V(a.charCodeAt(h));) h++;
							(h === l || h !== d) && (u = `\\\\${f}\\${a.slice(d, h)}`, o = h);
						}
					}
				} else o = 1;
				else ge(m) && a.charCodeAt(1) === fe && (u = a.slice(0, 2), o = 2, l > 2 && V(a.charCodeAt(2)) && (c = !0, o = 3));
				if (u.length > 0) if (t.length > 0) {
					if (u.toLowerCase() !== t.toLowerCase()) continue;
				} else t = u;
				if (r) {
					if (t.length > 0) break;
				} else if (n = `${a.slice(o)}\\${n}`, r = c, c && t.length > 0) break;
			}
			return n = dt(n, !r, "\\", V), r ? `${t}\\${n}` : `${t}${n}` || ".";
		},
		normalize(e) {
			G(e, "path");
			const t = e.length;
			if (t === 0) return ".";
			let n = 0, r, s = !1;
			const a = e.charCodeAt(0);
			if (t === 1) return Kt(a) ? "\\" : e;
			if (V(a)) if (s = !0, V(e.charCodeAt(1))) {
				let o = 2, u = o;
				for (; o < t && !V(e.charCodeAt(o));) o++;
				if (o < t && o !== u) {
					const c = e.slice(u, o);
					for (u = o; o < t && V(e.charCodeAt(o));) o++;
					if (o < t && o !== u) {
						for (u = o; o < t && !V(e.charCodeAt(o));) o++;
						if (o === t) return `\\\\${c}\\${e.slice(u)}\\`;
						o !== u && (r = `\\\\${c}\\${e.slice(u, o)}`, n = o);
					}
				}
			} else n = 1;
			else ge(a) && e.charCodeAt(1) === fe && (r = e.slice(0, 2), n = 2, t > 2 && V(e.charCodeAt(2)) && (s = !0, n = 3));
			let l = n < t ? dt(e.slice(n), !s, "\\", V) : "";
			if (l.length === 0 && !s && (l = "."), l.length > 0 && V(e.charCodeAt(t - 1)) && (l += "\\"), !s && r === void 0 && e.includes(":")) {
				if (l.length >= 2 && ge(l.charCodeAt(0)) && l.charCodeAt(1) === fe) return `.\\${l}`;
				let o = e.indexOf(":");
				do
					if (o === t - 1 || V(e.charCodeAt(o + 1))) return `.\\${l}`;
				while ((o = e.indexOf(":", o + 1)) !== -1);
			}
			return r === void 0 ? s ? `\\${l}` : l : s ? `${r}\\${l}` : `${r}${l}`;
		},
		isAbsolute(e) {
			G(e, "path");
			const t = e.length;
			if (t === 0) return !1;
			const n = e.charCodeAt(0);
			return V(n) || t > 2 && ge(n) && e.charCodeAt(1) === fe && V(e.charCodeAt(2));
		},
		join(...e) {
			if (e.length === 0) return ".";
			let t, n;
			for (let a = 0; a < e.length; ++a) {
				const l = e[a];
				G(l, "path"), l.length > 0 && (t === void 0 ? t = n = l : t += `\\${l}`);
			}
			if (t === void 0) return ".";
			let r = !0, s = 0;
			if (typeof n == "string" && V(n.charCodeAt(0))) {
				++s;
				const a = n.length;
				a > 1 && V(n.charCodeAt(1)) && (++s, a > 2 && (V(n.charCodeAt(2)) ? ++s : r = !1));
			}
			if (r) {
				for (; s < t.length && V(t.charCodeAt(s));) s++;
				s >= 2 && (t = `\\${t.slice(s)}`);
			}
			return K.normalize(t);
		},
		relative(e, t) {
			if (G(e, "from"), G(t, "to"), e === t) return "";
			const n = K.resolve(e), r = K.resolve(t);
			if (n === r || (e = n.toLowerCase(), t = r.toLowerCase(), e === t)) return "";
			if (n.length !== e.length || r.length !== t.length) {
				const b = n.split("\\"), p = r.split("\\");
				b[b.length - 1] === "" && b.pop(), p[p.length - 1] === "" && p.pop();
				const y = b.length, v = p.length, L = y < v ? y : v;
				let _;
				for (_ = 0; _ < L && b[_].toLowerCase() === p[_].toLowerCase(); _++);
				return _ === 0 ? r : _ === L ? v > L ? p.slice(_).join("\\") : y > L ? "..\\".repeat(y - 1 - _) + ".." : "" : "..\\".repeat(y - _) + p.slice(_).join("\\");
			}
			let s = 0;
			for (; s < e.length && e.charCodeAt(s) === te;) s++;
			let a = e.length;
			for (; a - 1 > s && e.charCodeAt(a - 1) === te;) a--;
			const l = a - s;
			let o = 0;
			for (; o < t.length && t.charCodeAt(o) === te;) o++;
			let u = t.length;
			for (; u - 1 > o && t.charCodeAt(u - 1) === te;) u--;
			const c = u - o, m = l < c ? l : c;
			let h = -1, d = 0;
			for (; d < m; d++) {
				const b = e.charCodeAt(s + d);
				if (b !== t.charCodeAt(o + d)) break;
				b === te && (h = d);
			}
			if (d !== m) {
				if (h === -1) return r;
			} else {
				if (c > m) {
					if (t.charCodeAt(o + d) === te) return r.slice(o + d + 1);
					if (d === 2) return r.slice(o + d);
				}
				l > m && (e.charCodeAt(s + d) === te ? h = d : d === 2 && (h = 3)), h === -1 && (h = 0);
			}
			let f = "";
			for (d = s + h + 1; d <= a; ++d) (d === a || e.charCodeAt(d) === te) && (f += f.length === 0 ? ".." : "\\..");
			return o += h, f.length > 0 ? `${f}${r.slice(o, u)}` : (r.charCodeAt(o) === te && ++o, r.slice(o, u));
		},
		toNamespacedPath(e) {
			if (typeof e != "string" || e.length === 0) return e;
			const t = K.resolve(e);
			if (t.length <= 2) return e;
			if (t.charCodeAt(0) === te) {
				if (t.charCodeAt(1) === te) {
					const n = t.charCodeAt(2);
					if (n !== Ai && n !== Ne) return `\\\\?\\UNC\\${t.slice(2)}`;
				}
			} else if (ge(t.charCodeAt(0)) && t.charCodeAt(1) === fe && t.charCodeAt(2) === te) return `\\\\?\\${t}`;
			return t;
		},
		dirname(e) {
			G(e, "path");
			const t = e.length;
			if (t === 0) return ".";
			let n = -1, r = 0;
			const s = e.charCodeAt(0);
			if (t === 1) return V(s) ? e : ".";
			if (V(s)) {
				if (n = r = 1, V(e.charCodeAt(1))) {
					let o = 2, u = o;
					for (; o < t && !V(e.charCodeAt(o));) o++;
					if (o < t && o !== u) {
						for (u = o; o < t && V(e.charCodeAt(o));) o++;
						if (o < t && o !== u) {
							for (u = o; o < t && !V(e.charCodeAt(o));) o++;
							if (o === t) return e;
							o !== u && (n = r = o + 1);
						}
					}
				}
			} else ge(s) && e.charCodeAt(1) === fe && (n = t > 2 && V(e.charCodeAt(2)) ? 3 : 2, r = n);
			let a = -1, l = !0;
			for (let o = t - 1; o >= r; --o) if (V(e.charCodeAt(o))) {
				if (!l) {
					a = o;
					break;
				}
			} else l = !1;
			if (a === -1) {
				if (n === -1) return ".";
				a = n;
			}
			return e.slice(0, a);
		},
		basename(e, t) {
			t !== void 0 && G(t, "suffix"), G(e, "path");
			let n = 0, r = -1, s = !0, a;
			if (e.length >= 2 && ge(e.charCodeAt(0)) && e.charCodeAt(1) === fe && (n = 2), t !== void 0 && t.length > 0 && t.length <= e.length) {
				if (t === e) return "";
				let l = t.length - 1, o = -1;
				for (a = e.length - 1; a >= n; --a) {
					const u = e.charCodeAt(a);
					if (V(u)) {
						if (!s) {
							n = a + 1;
							break;
						}
					} else o === -1 && (s = !1, o = a + 1), l >= 0 && (u === t.charCodeAt(l) ? --l === -1 && (r = a) : (l = -1, r = o));
				}
				return n === r ? r = o : r === -1 && (r = e.length), e.slice(n, r);
			}
			for (a = e.length - 1; a >= n; --a) if (V(e.charCodeAt(a))) {
				if (!s) {
					n = a + 1;
					break;
				}
			} else r === -1 && (s = !1, r = a + 1);
			return r === -1 ? "" : e.slice(n, r);
		},
		extname(e) {
			G(e, "path");
			let t = 0, n = -1, r = 0, s = -1, a = !0, l = 0;
			e.length >= 2 && e.charCodeAt(1) === fe && ge(e.charCodeAt(0)) && (t = r = 2);
			for (let o = e.length - 1; o >= t; --o) {
				const u = e.charCodeAt(o);
				if (V(u)) {
					if (!a) {
						r = o + 1;
						break;
					}
					continue;
				}
				s === -1 && (a = !1, s = o + 1), u === Ne ? n === -1 ? n = o : l !== 1 && (l = 1) : n !== -1 && (l = -1);
			}
			return n === -1 || s === -1 || l === 0 || l === 1 && n === s - 1 && n === r + 1 ? "" : e.slice(n, s);
		},
		format: Y1.bind(null, "\\"),
		parse(e) {
			G(e, "path");
			const t = {
				root: "",
				dir: "",
				base: "",
				ext: "",
				name: ""
			};
			if (e.length === 0) return t;
			const n = e.length;
			let r = 0, s = e.charCodeAt(0);
			if (n === 1) return V(s) ? (t.root = t.dir = e, t) : (t.base = t.name = e, t);
			if (V(s)) {
				if (r = 1, V(e.charCodeAt(1))) {
					let h = 2, d = h;
					for (; h < n && !V(e.charCodeAt(h));) h++;
					if (h < n && h !== d) {
						for (d = h; h < n && V(e.charCodeAt(h));) h++;
						if (h < n && h !== d) {
							for (d = h; h < n && !V(e.charCodeAt(h));) h++;
							h === n ? r = h : h !== d && (r = h + 1);
						}
					}
				}
			} else if (ge(s) && e.charCodeAt(1) === fe) {
				if (n <= 2) return t.root = t.dir = e, t;
				if (r = 2, V(e.charCodeAt(2))) {
					if (n === 3) return t.root = t.dir = e, t;
					r = 3;
				}
			}
			r > 0 && (t.root = e.slice(0, r));
			let a = -1, l = r, o = -1, u = !0, c = e.length - 1, m = 0;
			for (; c >= r; --c) {
				if (s = e.charCodeAt(c), V(s)) {
					if (!u) {
						l = c + 1;
						break;
					}
					continue;
				}
				o === -1 && (u = !1, o = c + 1), s === Ne ? a === -1 ? a = c : m !== 1 && (m = 1) : a !== -1 && (m = -1);
			}
			return o !== -1 && (a === -1 || m === 0 || m === 1 && a === o - 1 && a === l + 1 ? t.base = t.name = e.slice(l, o) : (t.name = e.slice(l, a), t.base = e.slice(l, o), t.ext = e.slice(a, o))), l > 0 && l !== r ? t.dir = e.slice(0, l - 1) : t.dir = t.root, t;
		},
		sep: "\\",
		delimiter: ";",
		win32: null,
		posix: null
	}, ki = (() => {
		if (ye) {
			const e = /\\/g;
			return () => {
				const t = gt().replace(e, "/");
				return t.slice(t.indexOf("/"));
			};
		}
		return () => gt();
	})(), ne = {
		resolve(...e) {
			let t = "", n = !1;
			for (let r = e.length - 1; r >= 0 && !n; r--) {
				const s = e[r];
				G(s, `paths[${r}]`), s.length !== 0 && (t = `${s}/${t}`, n = s.charCodeAt(0) === Q);
			}
			if (!n) {
				const r = ki();
				t = `${r}/${t}`, n = r.charCodeAt(0) === Q;
			}
			return t = dt(t, !n, "/", Kt), n ? `/${t}` : t.length > 0 ? t : ".";
		},
		normalize(e) {
			if (G(e, "path"), e.length === 0) return ".";
			const t = e.charCodeAt(0) === Q, n = e.charCodeAt(e.length - 1) === Q;
			return e = dt(e, !t, "/", Kt), e.length === 0 ? t ? "/" : n ? "./" : "." : (n && (e += "/"), t ? `/${e}` : e);
		},
		isAbsolute(e) {
			return G(e, "path"), e.length > 0 && e.charCodeAt(0) === Q;
		},
		join(...e) {
			if (e.length === 0) return ".";
			const t = [];
			for (let n = 0; n < e.length; ++n) {
				const r = e[n];
				G(r, "path"), r.length > 0 && t.push(r);
			}
			return t.length === 0 ? "." : ne.normalize(t.join("/"));
		},
		relative(e, t) {
			if (G(e, "from"), G(t, "to"), e === t || (e = ne.resolve(e), t = ne.resolve(t), e === t)) return "";
			const n = 1, r = e.length, s = r - n, a = 1, l = t.length - a, o = s < l ? s : l;
			let u = -1, c = 0;
			for (; c < o; c++) {
				const h = e.charCodeAt(n + c);
				if (h !== t.charCodeAt(a + c)) break;
				h === Q && (u = c);
			}
			if (c === o) if (l > o) {
				if (t.charCodeAt(a + c) === Q) return t.slice(a + c + 1);
				if (c === 0) return t.slice(a + c);
			} else s > o && (e.charCodeAt(n + c) === Q ? u = c : c === 0 && (u = 0));
			let m = "";
			for (c = n + u + 1; c <= r; ++c) (c === r || e.charCodeAt(c) === Q) && (m += m.length === 0 ? ".." : "/..");
			return `${m}${t.slice(a + u)}`;
		},
		toNamespacedPath(e) {
			return e;
		},
		dirname(e) {
			if (G(e, "path"), e.length === 0) return ".";
			const t = e.charCodeAt(0) === Q;
			let n = -1, r = !0;
			for (let s = e.length - 1; s >= 1; --s) if (e.charCodeAt(s) === Q) {
				if (!r) {
					n = s;
					break;
				}
			} else r = !1;
			return n === -1 ? t ? "/" : "." : t && n === 1 ? "//" : e.slice(0, n);
		},
		basename(e, t) {
			t !== void 0 && G(t, "suffix"), G(e, "path");
			let n = 0, r = -1, s = !0, a;
			if (t !== void 0 && t.length > 0 && t.length <= e.length) {
				if (t === e) return "";
				let l = t.length - 1, o = -1;
				for (a = e.length - 1; a >= 0; --a) {
					const u = e.charCodeAt(a);
					if (u === Q) {
						if (!s) {
							n = a + 1;
							break;
						}
					} else o === -1 && (s = !1, o = a + 1), l >= 0 && (u === t.charCodeAt(l) ? --l === -1 && (r = a) : (l = -1, r = o));
				}
				return n === r ? r = o : r === -1 && (r = e.length), e.slice(n, r);
			}
			for (a = e.length - 1; a >= 0; --a) if (e.charCodeAt(a) === Q) {
				if (!s) {
					n = a + 1;
					break;
				}
			} else r === -1 && (s = !1, r = a + 1);
			return r === -1 ? "" : e.slice(n, r);
		},
		extname(e) {
			G(e, "path");
			let t = -1, n = 0, r = -1, s = !0, a = 0;
			for (let l = e.length - 1; l >= 0; --l) {
				const o = e[l];
				if (o === "/") {
					if (!s) {
						n = l + 1;
						break;
					}
					continue;
				}
				r === -1 && (s = !1, r = l + 1), o === "." ? t === -1 ? t = l : a !== 1 && (a = 1) : t !== -1 && (a = -1);
			}
			return t === -1 || r === -1 || a === 0 || a === 1 && t === r - 1 && t === n + 1 ? "" : e.slice(t, r);
		},
		format: Y1.bind(null, "/"),
		parse(e) {
			G(e, "path");
			const t = {
				root: "",
				dir: "",
				base: "",
				ext: "",
				name: ""
			};
			if (e.length === 0) return t;
			const n = e.charCodeAt(0) === Q;
			let r;
			n ? (t.root = "/", r = 1) : r = 0;
			let s = -1, a = 0, l = -1, o = !0, u = e.length - 1, c = 0;
			for (; u >= r; --u) {
				const m = e.charCodeAt(u);
				if (m === Q) {
					if (!o) {
						a = u + 1;
						break;
					}
					continue;
				}
				l === -1 && (o = !1, l = u + 1), m === Ne ? s === -1 ? s = u : c !== 1 && (c = 1) : s !== -1 && (c = -1);
			}
			if (l !== -1) {
				const m = a === 0 && n ? 1 : a;
				s === -1 || c === 0 || c === 1 && s === l - 1 && s === a + 1 ? t.base = t.name = e.slice(m, l) : (t.name = e.slice(m, s), t.base = e.slice(m, l), t.ext = e.slice(s, l));
			}
			return a > 0 ? t.dir = e.slice(0, a - 1) : n && (t.dir = "/"), t;
		},
		sep: "/",
		delimiter: ":",
		win32: null,
		posix: null
	};
	ne.win32 = K.win32 = K, ne.posix = K.posix = ne;
	ye ? K.normalize : ne.normalize;
	ye ? K.resolve : ne.resolve;
	ye ? K.relative : ne.relative;
	ye ? K.dirname : ne.dirname;
	ye ? K.basename : ne.basename;
	ye ? K.extname : ne.extname;
	ye ? K.sep : ne.sep;
	const Mi = /^\w[\w\d+.-]*$/, Ei = /^\//, Pi = /^\/\//;
	function Di(e, t) {
		if (!e.scheme && t) throw new Error(`[UriError]: Scheme is missing: {scheme: "", authority: "${e.authority}", path: "${e.path}", query: "${e.query}", fragment: "${e.fragment}"}`);
		if (e.scheme && !Mi.test(e.scheme)) throw new Error("[UriError]: Scheme contains illegal characters.");
		if (e.path) {
			if (e.authority) {
				if (!Ei.test(e.path)) throw new Error("[UriError]: If a URI contains an authority component, then the path component must either be empty or begin with a slash (\"/\") character");
			} else if (Pi.test(e.path)) throw new Error("[UriError]: If a URI does not contain an authority component, then the path cannot begin with two slash characters (\"//\")");
		}
	}
	function Ti(e, t) {
		return !e && !t ? "file" : e;
	}
	function Fi(e, t) {
		switch (e) {
			case "https":
			case "http":
			case "file":
				t ? t[0] !== le && (t = le + t) : t = le;
				break;
		}
		return t;
	}
	const z = "", le = "/", Ii = /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
	var e1 = class kt {
		static isUri(t) {
			return t instanceof kt ? !0 : !t || typeof t != "object" ? !1 : typeof t.authority == "string" && typeof t.fragment == "string" && typeof t.path == "string" && typeof t.query == "string" && typeof t.scheme == "string" && typeof t.fsPath == "string" && typeof t.with == "function" && typeof t.toString == "function";
		}
		constructor(t, n, r, s, a, l = !1) {
			typeof t == "object" ? (this.scheme = t.scheme || z, this.authority = t.authority || z, this.path = t.path || z, this.query = t.query || z, this.fragment = t.fragment || z) : (this.scheme = Ti(t, l), this.authority = n || z, this.path = Fi(this.scheme, r || z), this.query = s || z, this.fragment = a || z, Di(this, l));
		}
		get fsPath() {
			return t1(this, !1);
		}
		with(t) {
			if (!t) return this;
			let { scheme: n, authority: r, path: s, query: a, fragment: l } = t;
			return n === void 0 ? n = this.scheme : n === null && (n = z), r === void 0 ? r = this.authority : r === null && (r = z), s === void 0 ? s = this.path : s === null && (s = z), a === void 0 ? a = this.query : a === null && (a = z), l === void 0 ? l = this.fragment : l === null && (l = z), n === this.scheme && r === this.authority && s === this.path && a === this.query && l === this.fragment ? this : new De(n, r, s, a, l);
		}
		static parse(t, n = !1) {
			const r = Ii.exec(t);
			return r ? new De(r[2] || z, pt(r[4] || z), pt(r[5] || z), pt(r[7] || z), pt(r[9] || z), n) : new De(z, z, z, z, z);
		}
		static file(t) {
			let n = z;
			if (ze && (t = t.replace(/\\/g, le)), t[0] === le && t[1] === le) {
				const r = t.indexOf(le, 2);
				r === -1 ? (n = t.substring(2), t = le) : (n = t.substring(2, r), t = t.substring(r) || le);
			}
			return new De("file", n, t, z, z);
		}
		static from(t, n) {
			return new De(t.scheme, t.authority, t.path, t.query, t.fragment, n);
		}
		static joinPath(t, ...n) {
			if (!t.path) throw new Error("[UriError]: cannot call joinPath on URI without path");
			let r;
			return ze && t.scheme === "file" ? r = kt.file(K.join(t1(t, !0), ...n)).path : r = ne.join(t.path, ...n), t.with({ path: r });
		}
		toString(t = !1) {
			return n1(this, t);
		}
		toJSON() {
			return this;
		}
		static revive(t) {
			if (t) {
				if (t instanceof kt) return t;
				{
					const n = new De(t);
					return n._formatted = t.external ?? null, n._fsPath = t._sep === J1 ? t.fsPath ?? null : null, n;
				}
			} else return t;
		}
	};
	const J1 = ze ? 1 : void 0;
	var De = class extends e1 {
		constructor() {
			super(...arguments), this._formatted = null, this._fsPath = null;
		}
		get fsPath() {
			return this._fsPath || (this._fsPath = t1(this, !1)), this._fsPath;
		}
		toString(e = !1) {
			return e ? n1(this, !0) : (this._formatted || (this._formatted = n1(this, !1)), this._formatted);
		}
		toJSON() {
			const e = { $mid: 1 };
			return this._fsPath && (e.fsPath = this._fsPath, e._sep = J1), this._formatted && (e.external = this._formatted), this.path && (e.path = this.path), this.scheme && (e.scheme = this.scheme), this.authority && (e.authority = this.authority), this.query && (e.query = this.query), this.fragment && (e.fragment = this.fragment), e;
		}
	};
	const Z1 = {
		58: "%3A",
		47: "%2F",
		63: "%3F",
		35: "%23",
		91: "%5B",
		93: "%5D",
		64: "%40",
		33: "%21",
		36: "%24",
		38: "%26",
		39: "%27",
		40: "%28",
		41: "%29",
		42: "%2A",
		43: "%2B",
		44: "%2C",
		59: "%3B",
		61: "%3D",
		32: "%20"
	};
	function K1(e, t, n) {
		let r, s = -1;
		for (let a = 0; a < e.length; a++) {
			const l = e.charCodeAt(a);
			if (l >= 97 && l <= 122 || l >= 65 && l <= 90 || l >= 48 && l <= 57 || l === 45 || l === 46 || l === 95 || l === 126 || t && l === 47 || n && l === 91 || n && l === 93 || n && l === 58) s !== -1 && (r += encodeURIComponent(e.substring(s, a)), s = -1), r !== void 0 && (r += e.charAt(a));
			else {
				r === void 0 && (r = e.substr(0, a));
				const o = Z1[l];
				o !== void 0 ? (s !== -1 && (r += encodeURIComponent(e.substring(s, a)), s = -1), r += o) : s === -1 && (s = a);
			}
		}
		return s !== -1 && (r += encodeURIComponent(e.substring(s))), r !== void 0 ? r : e;
	}
	function Vi(e) {
		let t;
		for (let n = 0; n < e.length; n++) {
			const r = e.charCodeAt(n);
			r === 35 || r === 63 ? (t === void 0 && (t = e.substr(0, n)), t += Z1[r]) : t !== void 0 && (t += e[n]);
		}
		return t !== void 0 ? t : e;
	}
	function t1(e, t) {
		let n;
		return e.authority && e.path.length > 1 && e.scheme === "file" ? n = `//${e.authority}${e.path}` : e.path.charCodeAt(0) === 47 && (e.path.charCodeAt(1) >= 65 && e.path.charCodeAt(1) <= 90 || e.path.charCodeAt(1) >= 97 && e.path.charCodeAt(1) <= 122) && e.path.charCodeAt(2) === 58 ? t ? n = e.path.substr(1) : n = e.path[1].toLowerCase() + e.path.substr(2) : n = e.path, ze && (n = n.replace(/\//g, "\\")), n;
	}
	function n1(e, t) {
		const n = t ? Vi : K1;
		let r = "", { scheme: s, authority: a, path: l, query: o, fragment: u } = e;
		if (s && (r += s, r += ":"), (a || s === "file") && (r += le, r += le), a) {
			let c = a.indexOf("@");
			if (c !== -1) {
				const m = a.substr(0, c);
				a = a.substr(c + 1), c = m.lastIndexOf(":"), c === -1 ? r += n(m, !1, !1) : (r += n(m.substr(0, c), !1, !1), r += ":", r += n(m.substr(c + 1), !1, !0)), r += "@";
			}
			a = a.toLowerCase(), c = a.lastIndexOf(":"), c === -1 ? r += n(a, !1, !0) : (r += n(a.substr(0, c), !1, !0), r += a.substr(c));
		}
		if (l) {
			if (l.length >= 3 && l.charCodeAt(0) === 47 && l.charCodeAt(2) === 58) {
				const c = l.charCodeAt(1);
				c >= 65 && c <= 90 && (l = `/${String.fromCharCode(c + 32)}:${l.substr(3)}`);
			} else if (l.length >= 2 && l.charCodeAt(1) === 58) {
				const c = l.charCodeAt(0);
				c >= 65 && c <= 90 && (l = `${String.fromCharCode(c + 32)}:${l.substr(2)}`);
			}
			r += n(l, !0, !1);
		}
		return o && (r += "?", r += n(o, !1, !1)), u && (r += "#", r += t ? u : K1(u, !1, !1)), r;
	}
	function en(e) {
		try {
			return decodeURIComponent(e);
		} catch {
			return e.length > 3 ? e.substr(0, 3) + en(e.substr(3)) : e;
		}
	}
	const tn = /(%[0-9A-Za-z][0-9A-Za-z])+/g;
	function pt(e) {
		return e.match(tn) ? e.replace(tn, (t) => en(t)) : e;
	}
	var Bi = class ie extends I {
		constructor(t, n, r, s) {
			super(t, n, r, s), this.selectionStartLineNumber = t, this.selectionStartColumn = n, this.positionLineNumber = r, this.positionColumn = s;
		}
		toString() {
			return "[" + this.selectionStartLineNumber + "," + this.selectionStartColumn + " -> " + this.positionLineNumber + "," + this.positionColumn + "]";
		}
		equalsSelection(t) {
			return ie.selectionsEqual(this, t);
		}
		static selectionsEqual(t, n) {
			return t.selectionStartLineNumber === n.selectionStartLineNumber && t.selectionStartColumn === n.selectionStartColumn && t.positionLineNumber === n.positionLineNumber && t.positionColumn === n.positionColumn;
		}
		getDirection() {
			return this.selectionStartLineNumber === this.startLineNumber && this.selectionStartColumn === this.startColumn ? 0 : 1;
		}
		setEndPosition(t, n) {
			return this.getDirection() === 0 ? new ie(this.startLineNumber, this.startColumn, t, n) : new ie(t, n, this.startLineNumber, this.startColumn);
		}
		getPosition() {
			return new W(this.positionLineNumber, this.positionColumn);
		}
		getSelectionStart() {
			return new W(this.selectionStartLineNumber, this.selectionStartColumn);
		}
		setStartPosition(t, n) {
			return this.getDirection() === 0 ? new ie(t, n, this.endLineNumber, this.endColumn) : new ie(this.endLineNumber, this.endColumn, t, n);
		}
		static fromPositions(t, n = t) {
			return new ie(t.lineNumber, t.column, n.lineNumber, n.column);
		}
		static fromRange(t, n) {
			return n === 0 ? new ie(t.startLineNumber, t.startColumn, t.endLineNumber, t.endColumn) : new ie(t.endLineNumber, t.endColumn, t.startLineNumber, t.startColumn);
		}
		static liftSelection(t) {
			return new ie(t.selectionStartLineNumber, t.selectionStartColumn, t.positionLineNumber, t.positionColumn);
		}
		static selectionsArrEqual(t, n) {
			if (t && !n || !t && n) return !1;
			if (!t && !n) return !0;
			if (t.length !== n.length) return !1;
			for (let r = 0, s = t.length; r < s; r++) if (!this.selectionsEqual(t[r], n[r])) return !1;
			return !0;
		}
		static isISelection(t) {
			return !!t && typeof t.selectionStartLineNumber == "number" && typeof t.selectionStartColumn == "number" && typeof t.positionLineNumber == "number" && typeof t.positionColumn == "number";
		}
		static createWithDirection(t, n, r, s, a) {
			return a === 0 ? new ie(t, n, r, s) : new ie(r, s, t, n);
		}
	};
	const nn = Object.create(null);
	function i(e, t) {
		if (hs(t)) {
			const n = nn[t];
			if (n === void 0) throw new Error(`${e} references an unknown codicon: ${t}`);
			t = n;
		}
		return nn[e] = t, { id: e };
	}
	const qi = {
		add: i("add", 6e4),
		plus: i("plus", 6e4),
		gistNew: i("gist-new", 6e4),
		repoCreate: i("repo-create", 6e4),
		lightbulb: i("lightbulb", 60001),
		lightBulb: i("light-bulb", 60001),
		repo: i("repo", 60002),
		repoDelete: i("repo-delete", 60002),
		gistFork: i("gist-fork", 60003),
		repoForked: i("repo-forked", 60003),
		gitPullRequest: i("git-pull-request", 60004),
		gitPullRequestAbandoned: i("git-pull-request-abandoned", 60004),
		recordKeys: i("record-keys", 60005),
		keyboard: i("keyboard", 60005),
		tag: i("tag", 60006),
		gitPullRequestLabel: i("git-pull-request-label", 60006),
		tagAdd: i("tag-add", 60006),
		tagRemove: i("tag-remove", 60006),
		person: i("person", 60007),
		personFollow: i("person-follow", 60007),
		personOutline: i("person-outline", 60007),
		personFilled: i("person-filled", 60007),
		sourceControl: i("source-control", 60008),
		mirror: i("mirror", 60009),
		mirrorPublic: i("mirror-public", 60009),
		star: i("star", 60010),
		starAdd: i("star-add", 60010),
		starDelete: i("star-delete", 60010),
		starEmpty: i("star-empty", 60010),
		comment: i("comment", 60011),
		commentAdd: i("comment-add", 60011),
		alert: i("alert", 60012),
		warning: i("warning", 60012),
		search: i("search", 60013),
		searchSave: i("search-save", 60013),
		logOut: i("log-out", 60014),
		signOut: i("sign-out", 60014),
		logIn: i("log-in", 60015),
		signIn: i("sign-in", 60015),
		eye: i("eye", 60016),
		eyeUnwatch: i("eye-unwatch", 60016),
		eyeWatch: i("eye-watch", 60016),
		circleFilled: i("circle-filled", 60017),
		primitiveDot: i("primitive-dot", 60017),
		closeDirty: i("close-dirty", 60017),
		debugBreakpoint: i("debug-breakpoint", 60017),
		debugBreakpointDisabled: i("debug-breakpoint-disabled", 60017),
		debugHint: i("debug-hint", 60017),
		terminalDecorationSuccess: i("terminal-decoration-success", 60017),
		primitiveSquare: i("primitive-square", 60018),
		edit: i("edit", 60019),
		pencil: i("pencil", 60019),
		info: i("info", 60020),
		issueOpened: i("issue-opened", 60020),
		gistPrivate: i("gist-private", 60021),
		gitForkPrivate: i("git-fork-private", 60021),
		lock: i("lock", 60021),
		mirrorPrivate: i("mirror-private", 60021),
		close: i("close", 60022),
		removeClose: i("remove-close", 60022),
		x: i("x", 60022),
		repoSync: i("repo-sync", 60023),
		sync: i("sync", 60023),
		clone: i("clone", 60024),
		desktopDownload: i("desktop-download", 60024),
		beaker: i("beaker", 60025),
		microscope: i("microscope", 60025),
		vm: i("vm", 60026),
		deviceDesktop: i("device-desktop", 60026),
		file: i("file", 60027),
		more: i("more", 60028),
		ellipsis: i("ellipsis", 60028),
		kebabHorizontal: i("kebab-horizontal", 60028),
		mailReply: i("mail-reply", 60029),
		reply: i("reply", 60029),
		organization: i("organization", 60030),
		organizationFilled: i("organization-filled", 60030),
		organizationOutline: i("organization-outline", 60030),
		newFile: i("new-file", 60031),
		fileAdd: i("file-add", 60031),
		newFolder: i("new-folder", 60032),
		fileDirectoryCreate: i("file-directory-create", 60032),
		trash: i("trash", 60033),
		trashcan: i("trashcan", 60033),
		history: i("history", 60034),
		clock: i("clock", 60034),
		folder: i("folder", 60035),
		fileDirectory: i("file-directory", 60035),
		symbolFolder: i("symbol-folder", 60035),
		logoGithub: i("logo-github", 60036),
		markGithub: i("mark-github", 60036),
		github: i("github", 60036),
		terminal: i("terminal", 60037),
		console: i("console", 60037),
		repl: i("repl", 60037),
		zap: i("zap", 60038),
		symbolEvent: i("symbol-event", 60038),
		error: i("error", 60039),
		stop: i("stop", 60039),
		variable: i("variable", 60040),
		symbolVariable: i("symbol-variable", 60040),
		array: i("array", 60042),
		symbolArray: i("symbol-array", 60042),
		symbolModule: i("symbol-module", 60043),
		symbolPackage: i("symbol-package", 60043),
		symbolNamespace: i("symbol-namespace", 60043),
		symbolObject: i("symbol-object", 60043),
		symbolMethod: i("symbol-method", 60044),
		symbolFunction: i("symbol-function", 60044),
		symbolConstructor: i("symbol-constructor", 60044),
		symbolBoolean: i("symbol-boolean", 60047),
		symbolNull: i("symbol-null", 60047),
		symbolNumeric: i("symbol-numeric", 60048),
		symbolNumber: i("symbol-number", 60048),
		symbolStructure: i("symbol-structure", 60049),
		symbolStruct: i("symbol-struct", 60049),
		symbolParameter: i("symbol-parameter", 60050),
		symbolTypeParameter: i("symbol-type-parameter", 60050),
		symbolKey: i("symbol-key", 60051),
		symbolText: i("symbol-text", 60051),
		symbolReference: i("symbol-reference", 60052),
		goToFile: i("go-to-file", 60052),
		symbolEnum: i("symbol-enum", 60053),
		symbolValue: i("symbol-value", 60053),
		symbolRuler: i("symbol-ruler", 60054),
		symbolUnit: i("symbol-unit", 60054),
		activateBreakpoints: i("activate-breakpoints", 60055),
		archive: i("archive", 60056),
		arrowBoth: i("arrow-both", 60057),
		arrowDown: i("arrow-down", 60058),
		arrowLeft: i("arrow-left", 60059),
		arrowRight: i("arrow-right", 60060),
		arrowSmallDown: i("arrow-small-down", 60061),
		arrowSmallLeft: i("arrow-small-left", 60062),
		arrowSmallRight: i("arrow-small-right", 60063),
		arrowSmallUp: i("arrow-small-up", 60064),
		arrowUp: i("arrow-up", 60065),
		bell: i("bell", 60066),
		bold: i("bold", 60067),
		book: i("book", 60068),
		bookmark: i("bookmark", 60069),
		debugBreakpointConditionalUnverified: i("debug-breakpoint-conditional-unverified", 60070),
		debugBreakpointConditional: i("debug-breakpoint-conditional", 60071),
		debugBreakpointConditionalDisabled: i("debug-breakpoint-conditional-disabled", 60071),
		debugBreakpointDataUnverified: i("debug-breakpoint-data-unverified", 60072),
		debugBreakpointData: i("debug-breakpoint-data", 60073),
		debugBreakpointDataDisabled: i("debug-breakpoint-data-disabled", 60073),
		debugBreakpointLogUnverified: i("debug-breakpoint-log-unverified", 60074),
		debugBreakpointLog: i("debug-breakpoint-log", 60075),
		debugBreakpointLogDisabled: i("debug-breakpoint-log-disabled", 60075),
		briefcase: i("briefcase", 60076),
		broadcast: i("broadcast", 60077),
		browser: i("browser", 60078),
		bug: i("bug", 60079),
		calendar: i("calendar", 60080),
		caseSensitive: i("case-sensitive", 60081),
		check: i("check", 60082),
		checklist: i("checklist", 60083),
		chevronDown: i("chevron-down", 60084),
		chevronLeft: i("chevron-left", 60085),
		chevronRight: i("chevron-right", 60086),
		chevronUp: i("chevron-up", 60087),
		chromeClose: i("chrome-close", 60088),
		chromeMaximize: i("chrome-maximize", 60089),
		chromeMinimize: i("chrome-minimize", 60090),
		chromeRestore: i("chrome-restore", 60091),
		circleOutline: i("circle-outline", 60092),
		circle: i("circle", 60092),
		debugBreakpointUnverified: i("debug-breakpoint-unverified", 60092),
		terminalDecorationIncomplete: i("terminal-decoration-incomplete", 60092),
		circleSlash: i("circle-slash", 60093),
		circuitBoard: i("circuit-board", 60094),
		clearAll: i("clear-all", 60095),
		clippy: i("clippy", 60096),
		closeAll: i("close-all", 60097),
		cloudDownload: i("cloud-download", 60098),
		cloudUpload: i("cloud-upload", 60099),
		code: i("code", 60100),
		collapseAll: i("collapse-all", 60101),
		colorMode: i("color-mode", 60102),
		commentDiscussion: i("comment-discussion", 60103),
		creditCard: i("credit-card", 60105),
		dash: i("dash", 60108),
		dashboard: i("dashboard", 60109),
		database: i("database", 60110),
		debugContinue: i("debug-continue", 60111),
		debugDisconnect: i("debug-disconnect", 60112),
		debugPause: i("debug-pause", 60113),
		debugRestart: i("debug-restart", 60114),
		debugStart: i("debug-start", 60115),
		debugStepInto: i("debug-step-into", 60116),
		debugStepOut: i("debug-step-out", 60117),
		debugStepOver: i("debug-step-over", 60118),
		debugStop: i("debug-stop", 60119),
		debug: i("debug", 60120),
		deviceCameraVideo: i("device-camera-video", 60121),
		deviceCamera: i("device-camera", 60122),
		deviceMobile: i("device-mobile", 60123),
		diffAdded: i("diff-added", 60124),
		diffIgnored: i("diff-ignored", 60125),
		diffModified: i("diff-modified", 60126),
		diffRemoved: i("diff-removed", 60127),
		diffRenamed: i("diff-renamed", 60128),
		diff: i("diff", 60129),
		diffSidebyside: i("diff-sidebyside", 60129),
		discard: i("discard", 60130),
		editorLayout: i("editor-layout", 60131),
		emptyWindow: i("empty-window", 60132),
		exclude: i("exclude", 60133),
		extensions: i("extensions", 60134),
		eyeClosed: i("eye-closed", 60135),
		fileBinary: i("file-binary", 60136),
		fileCode: i("file-code", 60137),
		fileMedia: i("file-media", 60138),
		filePdf: i("file-pdf", 60139),
		fileSubmodule: i("file-submodule", 60140),
		fileSymlinkDirectory: i("file-symlink-directory", 60141),
		fileSymlinkFile: i("file-symlink-file", 60142),
		fileZip: i("file-zip", 60143),
		files: i("files", 60144),
		filter: i("filter", 60145),
		flame: i("flame", 60146),
		foldDown: i("fold-down", 60147),
		foldUp: i("fold-up", 60148),
		fold: i("fold", 60149),
		folderActive: i("folder-active", 60150),
		folderOpened: i("folder-opened", 60151),
		gear: i("gear", 60152),
		gift: i("gift", 60153),
		gistSecret: i("gist-secret", 60154),
		gist: i("gist", 60155),
		gitCommit: i("git-commit", 60156),
		gitCompare: i("git-compare", 60157),
		compareChanges: i("compare-changes", 60157),
		gitMerge: i("git-merge", 60158),
		githubAction: i("github-action", 60159),
		githubAlt: i("github-alt", 60160),
		globe: i("globe", 60161),
		grabber: i("grabber", 60162),
		graph: i("graph", 60163),
		gripper: i("gripper", 60164),
		heart: i("heart", 60165),
		home: i("home", 60166),
		horizontalRule: i("horizontal-rule", 60167),
		hubot: i("hubot", 60168),
		inbox: i("inbox", 60169),
		issueReopened: i("issue-reopened", 60171),
		issues: i("issues", 60172),
		italic: i("italic", 60173),
		jersey: i("jersey", 60174),
		json: i("json", 60175),
		kebabVertical: i("kebab-vertical", 60176),
		key: i("key", 60177),
		law: i("law", 60178),
		lightbulbAutofix: i("lightbulb-autofix", 60179),
		linkExternal: i("link-external", 60180),
		link: i("link", 60181),
		listOrdered: i("list-ordered", 60182),
		listUnordered: i("list-unordered", 60183),
		liveShare: i("live-share", 60184),
		loading: i("loading", 60185),
		location: i("location", 60186),
		mailRead: i("mail-read", 60187),
		mail: i("mail", 60188),
		markdown: i("markdown", 60189),
		megaphone: i("megaphone", 60190),
		mention: i("mention", 60191),
		milestone: i("milestone", 60192),
		gitPullRequestMilestone: i("git-pull-request-milestone", 60192),
		mortarBoard: i("mortar-board", 60193),
		move: i("move", 60194),
		multipleWindows: i("multiple-windows", 60195),
		mute: i("mute", 60196),
		noNewline: i("no-newline", 60197),
		note: i("note", 60198),
		octoface: i("octoface", 60199),
		openPreview: i("open-preview", 60200),
		package: i("package", 60201),
		paintcan: i("paintcan", 60202),
		pin: i("pin", 60203),
		play: i("play", 60204),
		run: i("run", 60204),
		plug: i("plug", 60205),
		preserveCase: i("preserve-case", 60206),
		preview: i("preview", 60207),
		project: i("project", 60208),
		pulse: i("pulse", 60209),
		question: i("question", 60210),
		quote: i("quote", 60211),
		radioTower: i("radio-tower", 60212),
		reactions: i("reactions", 60213),
		references: i("references", 60214),
		refresh: i("refresh", 60215),
		regex: i("regex", 60216),
		remoteExplorer: i("remote-explorer", 60217),
		remote: i("remote", 60218),
		remove: i("remove", 60219),
		replaceAll: i("replace-all", 60220),
		replace: i("replace", 60221),
		repoClone: i("repo-clone", 60222),
		repoForcePush: i("repo-force-push", 60223),
		repoPull: i("repo-pull", 60224),
		repoPush: i("repo-push", 60225),
		report: i("report", 60226),
		requestChanges: i("request-changes", 60227),
		rocket: i("rocket", 60228),
		rootFolderOpened: i("root-folder-opened", 60229),
		rootFolder: i("root-folder", 60230),
		rss: i("rss", 60231),
		ruby: i("ruby", 60232),
		saveAll: i("save-all", 60233),
		saveAs: i("save-as", 60234),
		save: i("save", 60235),
		screenFull: i("screen-full", 60236),
		screenNormal: i("screen-normal", 60237),
		searchStop: i("search-stop", 60238),
		server: i("server", 60240),
		settingsGear: i("settings-gear", 60241),
		settings: i("settings", 60242),
		shield: i("shield", 60243),
		smiley: i("smiley", 60244),
		sortPrecedence: i("sort-precedence", 60245),
		splitHorizontal: i("split-horizontal", 60246),
		splitVertical: i("split-vertical", 60247),
		squirrel: i("squirrel", 60248),
		starFull: i("star-full", 60249),
		starHalf: i("star-half", 60250),
		symbolClass: i("symbol-class", 60251),
		symbolColor: i("symbol-color", 60252),
		symbolConstant: i("symbol-constant", 60253),
		symbolEnumMember: i("symbol-enum-member", 60254),
		symbolField: i("symbol-field", 60255),
		symbolFile: i("symbol-file", 60256),
		symbolInterface: i("symbol-interface", 60257),
		symbolKeyword: i("symbol-keyword", 60258),
		symbolMisc: i("symbol-misc", 60259),
		symbolOperator: i("symbol-operator", 60260),
		symbolProperty: i("symbol-property", 60261),
		wrench: i("wrench", 60261),
		wrenchSubaction: i("wrench-subaction", 60261),
		symbolSnippet: i("symbol-snippet", 60262),
		tasklist: i("tasklist", 60263),
		telescope: i("telescope", 60264),
		textSize: i("text-size", 60265),
		threeBars: i("three-bars", 60266),
		thumbsdown: i("thumbsdown", 60267),
		thumbsup: i("thumbsup", 60268),
		tools: i("tools", 60269),
		triangleDown: i("triangle-down", 60270),
		triangleLeft: i("triangle-left", 60271),
		triangleRight: i("triangle-right", 60272),
		triangleUp: i("triangle-up", 60273),
		twitter: i("twitter", 60274),
		unfold: i("unfold", 60275),
		unlock: i("unlock", 60276),
		unmute: i("unmute", 60277),
		unverified: i("unverified", 60278),
		verified: i("verified", 60279),
		versions: i("versions", 60280),
		vmActive: i("vm-active", 60281),
		vmOutline: i("vm-outline", 60282),
		vmRunning: i("vm-running", 60283),
		watch: i("watch", 60284),
		whitespace: i("whitespace", 60285),
		wholeWord: i("whole-word", 60286),
		window: i("window", 60287),
		wordWrap: i("word-wrap", 60288),
		zoomIn: i("zoom-in", 60289),
		zoomOut: i("zoom-out", 60290),
		listFilter: i("list-filter", 60291),
		listFlat: i("list-flat", 60292),
		listSelection: i("list-selection", 60293),
		selection: i("selection", 60293),
		listTree: i("list-tree", 60294),
		debugBreakpointFunctionUnverified: i("debug-breakpoint-function-unverified", 60295),
		debugBreakpointFunction: i("debug-breakpoint-function", 60296),
		debugBreakpointFunctionDisabled: i("debug-breakpoint-function-disabled", 60296),
		debugStackframeActive: i("debug-stackframe-active", 60297),
		circleSmallFilled: i("circle-small-filled", 60298),
		debugStackframeDot: i("debug-stackframe-dot", 60298),
		terminalDecorationMark: i("terminal-decoration-mark", 60298),
		debugStackframe: i("debug-stackframe", 60299),
		debugStackframeFocused: i("debug-stackframe-focused", 60299),
		debugBreakpointUnsupported: i("debug-breakpoint-unsupported", 60300),
		symbolString: i("symbol-string", 60301),
		debugReverseContinue: i("debug-reverse-continue", 60302),
		debugStepBack: i("debug-step-back", 60303),
		debugRestartFrame: i("debug-restart-frame", 60304),
		debugAlt: i("debug-alt", 60305),
		callIncoming: i("call-incoming", 60306),
		callOutgoing: i("call-outgoing", 60307),
		menu: i("menu", 60308),
		expandAll: i("expand-all", 60309),
		feedback: i("feedback", 60310),
		gitPullRequestReviewer: i("git-pull-request-reviewer", 60310),
		groupByRefType: i("group-by-ref-type", 60311),
		ungroupByRefType: i("ungroup-by-ref-type", 60312),
		account: i("account", 60313),
		gitPullRequestAssignee: i("git-pull-request-assignee", 60313),
		bellDot: i("bell-dot", 60314),
		debugConsole: i("debug-console", 60315),
		library: i("library", 60316),
		output: i("output", 60317),
		runAll: i("run-all", 60318),
		syncIgnored: i("sync-ignored", 60319),
		pinned: i("pinned", 60320),
		githubInverted: i("github-inverted", 60321),
		serverProcess: i("server-process", 60322),
		serverEnvironment: i("server-environment", 60323),
		pass: i("pass", 60324),
		issueClosed: i("issue-closed", 60324),
		stopCircle: i("stop-circle", 60325),
		playCircle: i("play-circle", 60326),
		record: i("record", 60327),
		debugAltSmall: i("debug-alt-small", 60328),
		vmConnect: i("vm-connect", 60329),
		cloud: i("cloud", 60330),
		merge: i("merge", 60331),
		export: i("export", 60332),
		graphLeft: i("graph-left", 60333),
		magnet: i("magnet", 60334),
		notebook: i("notebook", 60335),
		redo: i("redo", 60336),
		checkAll: i("check-all", 60337),
		pinnedDirty: i("pinned-dirty", 60338),
		passFilled: i("pass-filled", 60339),
		circleLargeFilled: i("circle-large-filled", 60340),
		circleLarge: i("circle-large", 60341),
		circleLargeOutline: i("circle-large-outline", 60341),
		combine: i("combine", 60342),
		gather: i("gather", 60342),
		table: i("table", 60343),
		variableGroup: i("variable-group", 60344),
		typeHierarchy: i("type-hierarchy", 60345),
		typeHierarchySub: i("type-hierarchy-sub", 60346),
		typeHierarchySuper: i("type-hierarchy-super", 60347),
		gitPullRequestCreate: i("git-pull-request-create", 60348),
		runAbove: i("run-above", 60349),
		runBelow: i("run-below", 60350),
		notebookTemplate: i("notebook-template", 60351),
		debugRerun: i("debug-rerun", 60352),
		workspaceTrusted: i("workspace-trusted", 60353),
		workspaceUntrusted: i("workspace-untrusted", 60354),
		workspaceUnknown: i("workspace-unknown", 60355),
		terminalCmd: i("terminal-cmd", 60356),
		terminalDebian: i("terminal-debian", 60357),
		terminalLinux: i("terminal-linux", 60358),
		terminalPowershell: i("terminal-powershell", 60359),
		terminalTmux: i("terminal-tmux", 60360),
		terminalUbuntu: i("terminal-ubuntu", 60361),
		terminalBash: i("terminal-bash", 60362),
		arrowSwap: i("arrow-swap", 60363),
		copy: i("copy", 60364),
		personAdd: i("person-add", 60365),
		filterFilled: i("filter-filled", 60366),
		wand: i("wand", 60367),
		debugLineByLine: i("debug-line-by-line", 60368),
		inspect: i("inspect", 60369),
		layers: i("layers", 60370),
		layersDot: i("layers-dot", 60371),
		layersActive: i("layers-active", 60372),
		compass: i("compass", 60373),
		compassDot: i("compass-dot", 60374),
		compassActive: i("compass-active", 60375),
		azure: i("azure", 60376),
		issueDraft: i("issue-draft", 60377),
		gitPullRequestClosed: i("git-pull-request-closed", 60378),
		gitPullRequestDraft: i("git-pull-request-draft", 60379),
		debugAll: i("debug-all", 60380),
		debugCoverage: i("debug-coverage", 60381),
		runErrors: i("run-errors", 60382),
		folderLibrary: i("folder-library", 60383),
		debugContinueSmall: i("debug-continue-small", 60384),
		beakerStop: i("beaker-stop", 60385),
		graphLine: i("graph-line", 60386),
		graphScatter: i("graph-scatter", 60387),
		pieChart: i("pie-chart", 60388),
		bracket: i("bracket", 60175),
		bracketDot: i("bracket-dot", 60389),
		bracketError: i("bracket-error", 60390),
		lockSmall: i("lock-small", 60391),
		azureDevops: i("azure-devops", 60392),
		verifiedFilled: i("verified-filled", 60393),
		newline: i("newline", 60394),
		layout: i("layout", 60395),
		layoutActivitybarLeft: i("layout-activitybar-left", 60396),
		layoutActivitybarRight: i("layout-activitybar-right", 60397),
		layoutPanelLeft: i("layout-panel-left", 60398),
		layoutPanelCenter: i("layout-panel-center", 60399),
		layoutPanelJustify: i("layout-panel-justify", 60400),
		layoutPanelRight: i("layout-panel-right", 60401),
		layoutPanel: i("layout-panel", 60402),
		layoutSidebarLeft: i("layout-sidebar-left", 60403),
		layoutSidebarRight: i("layout-sidebar-right", 60404),
		layoutStatusbar: i("layout-statusbar", 60405),
		layoutMenubar: i("layout-menubar", 60406),
		layoutCentered: i("layout-centered", 60407),
		target: i("target", 60408),
		indent: i("indent", 60409),
		recordSmall: i("record-small", 60410),
		errorSmall: i("error-small", 60411),
		terminalDecorationError: i("terminal-decoration-error", 60411),
		arrowCircleDown: i("arrow-circle-down", 60412),
		arrowCircleLeft: i("arrow-circle-left", 60413),
		arrowCircleRight: i("arrow-circle-right", 60414),
		arrowCircleUp: i("arrow-circle-up", 60415),
		layoutSidebarRightOff: i("layout-sidebar-right-off", 60416),
		layoutPanelOff: i("layout-panel-off", 60417),
		layoutSidebarLeftOff: i("layout-sidebar-left-off", 60418),
		blank: i("blank", 60419),
		heartFilled: i("heart-filled", 60420),
		map: i("map", 60421),
		mapHorizontal: i("map-horizontal", 60421),
		foldHorizontal: i("fold-horizontal", 60421),
		mapFilled: i("map-filled", 60422),
		mapHorizontalFilled: i("map-horizontal-filled", 60422),
		foldHorizontalFilled: i("fold-horizontal-filled", 60422),
		circleSmall: i("circle-small", 60423),
		bellSlash: i("bell-slash", 60424),
		bellSlashDot: i("bell-slash-dot", 60425),
		commentUnresolved: i("comment-unresolved", 60426),
		gitPullRequestGoToChanges: i("git-pull-request-go-to-changes", 60427),
		gitPullRequestNewChanges: i("git-pull-request-new-changes", 60428),
		searchFuzzy: i("search-fuzzy", 60429),
		commentDraft: i("comment-draft", 60430),
		send: i("send", 60431),
		sparkle: i("sparkle", 60432),
		insert: i("insert", 60433),
		mic: i("mic", 60434),
		thumbsdownFilled: i("thumbsdown-filled", 60435),
		thumbsupFilled: i("thumbsup-filled", 60436),
		coffee: i("coffee", 60437),
		snake: i("snake", 60438),
		game: i("game", 60439),
		vr: i("vr", 60440),
		chip: i("chip", 60441),
		piano: i("piano", 60442),
		music: i("music", 60443),
		micFilled: i("mic-filled", 60444),
		repoFetch: i("repo-fetch", 60445),
		copilot: i("copilot", 60446),
		lightbulbSparkle: i("lightbulb-sparkle", 60447),
		robot: i("robot", 60448),
		sparkleFilled: i("sparkle-filled", 60449),
		diffSingle: i("diff-single", 60450),
		diffMultiple: i("diff-multiple", 60451),
		surroundWith: i("surround-with", 60452),
		share: i("share", 60453),
		gitStash: i("git-stash", 60454),
		gitStashApply: i("git-stash-apply", 60455),
		gitStashPop: i("git-stash-pop", 60456),
		vscode: i("vscode", 60457),
		vscodeInsiders: i("vscode-insiders", 60458),
		codeOss: i("code-oss", 60459),
		runCoverage: i("run-coverage", 60460),
		runAllCoverage: i("run-all-coverage", 60461),
		coverage: i("coverage", 60462),
		githubProject: i("github-project", 60463),
		mapVertical: i("map-vertical", 60464),
		foldVertical: i("fold-vertical", 60464),
		mapVerticalFilled: i("map-vertical-filled", 60465),
		foldVerticalFilled: i("fold-vertical-filled", 60465),
		goToSearch: i("go-to-search", 60466),
		percentage: i("percentage", 60467),
		sortPercentage: i("sort-percentage", 60467),
		attach: i("attach", 60468),
		goToEditingSession: i("go-to-editing-session", 60469),
		editSession: i("edit-session", 60470),
		codeReview: i("code-review", 60471),
		copilotWarning: i("copilot-warning", 60472),
		python: i("python", 60473),
		copilotLarge: i("copilot-large", 60474),
		copilotWarningLarge: i("copilot-warning-large", 60475),
		keyboardTab: i("keyboard-tab", 60476),
		copilotBlocked: i("copilot-blocked", 60477),
		copilotNotConnected: i("copilot-not-connected", 60478),
		flag: i("flag", 60479),
		lightbulbEmpty: i("lightbulb-empty", 60480),
		symbolMethodArrow: i("symbol-method-arrow", 60481),
		copilotUnavailable: i("copilot-unavailable", 60482),
		repoPinned: i("repo-pinned", 60483),
		keyboardTabAbove: i("keyboard-tab-above", 60484),
		keyboardTabBelow: i("keyboard-tab-below", 60485),
		gitPullRequestDone: i("git-pull-request-done", 60486),
		mcp: i("mcp", 60487),
		extensionsLarge: i("extensions-large", 60488),
		layoutPanelDock: i("layout-panel-dock", 60489),
		layoutSidebarLeftDock: i("layout-sidebar-left-dock", 60490),
		layoutSidebarRightDock: i("layout-sidebar-right-dock", 60491),
		copilotInProgress: i("copilot-in-progress", 60492),
		copilotError: i("copilot-error", 60493),
		copilotSuccess: i("copilot-success", 60494),
		chatSparkle: i("chat-sparkle", 60495),
		searchSparkle: i("search-sparkle", 60496),
		editSparkle: i("edit-sparkle", 60497),
		copilotSnooze: i("copilot-snooze", 60498),
		sendToRemoteAgent: i("send-to-remote-agent", 60499),
		commentDiscussionSparkle: i("comment-discussion-sparkle", 60500),
		chatSparkleWarning: i("chat-sparkle-warning", 60501),
		chatSparkleError: i("chat-sparkle-error", 60502),
		collection: i("collection", 60503),
		newCollection: i("new-collection", 60504),
		thinking: i("thinking", 60505),
		build: i("build", 60506),
		commentDiscussionQuote: i("comment-discussion-quote", 60507),
		cursor: i("cursor", 60508),
		eraser: i("eraser", 60509),
		fileText: i("file-text", 60510),
		gitLens: i("git-lens", 60511),
		quotes: i("quotes", 60512),
		rename: i("rename", 60513),
		runWithDeps: i("run-with-deps", 60514),
		debugConnected: i("debug-connected", 60515),
		strikethrough: i("strikethrough", 60516),
		openInProduct: i("open-in-product", 60517),
		indexZero: i("index-zero", 60518),
		agent: i("agent", 60519),
		editCode: i("edit-code", 60520),
		repoSelected: i("repo-selected", 60521),
		skip: i("skip", 60522),
		mergeInto: i("merge-into", 60523),
		gitBranchChanges: i("git-branch-changes", 60524),
		gitBranchStagedChanges: i("git-branch-staged-changes", 60525),
		gitBranchConflicts: i("git-branch-conflicts", 60526),
		gitBranch: i("git-branch", 60527),
		gitBranchCreate: i("git-branch-create", 60527),
		gitBranchDelete: i("git-branch-delete", 60527),
		searchLarge: i("search-large", 60528),
		terminalGitBash: i("terminal-git-bash", 60529)
	}, Ui = {
		dialogError: i("dialog-error", "error"),
		dialogWarning: i("dialog-warning", "warning"),
		dialogInfo: i("dialog-info", "info"),
		dialogClose: i("dialog-close", "close"),
		treeItemExpanded: i("tree-item-expanded", "chevron-down"),
		treeFilterOnTypeOn: i("tree-filter-on-type-on", "list-filter"),
		treeFilterOnTypeOff: i("tree-filter-on-type-off", "list-selection"),
		treeFilterClear: i("tree-filter-clear", "close"),
		treeItemLoading: i("tree-item-loading", "loading"),
		menuSelection: i("menu-selection", "check"),
		menuSubmenu: i("menu-submenu", "chevron-right"),
		menuBarMore: i("menubar-more", "more"),
		scrollbarButtonLeft: i("scrollbar-button-left", "triangle-left"),
		scrollbarButtonRight: i("scrollbar-button-right", "triangle-right"),
		scrollbarButtonUp: i("scrollbar-button-up", "triangle-up"),
		scrollbarButtonDown: i("scrollbar-button-down", "triangle-down"),
		toolBarMore: i("toolbar-more", "more"),
		quickInputBack: i("quick-input-back", "arrow-left"),
		dropDownButton: i("drop-down-button", 60084),
		symbolCustomColor: i("symbol-customcolor", 60252),
		exportIcon: i("export", 60332),
		workspaceUnspecified: i("workspace-unspecified", 60355),
		newLine: i("newline", 60394),
		thumbsDownFilled: i("thumbsdown-filled", 60435),
		thumbsUpFilled: i("thumbsup-filled", 60436),
		gitFetch: i("git-fetch", 60445),
		lightbulbSparkleAutofix: i("lightbulb-sparkle-autofix", 60447),
		debugBreakpointPending: i("debug-breakpoint-pending", 60377)
	}, P = {
		...qi,
		...Ui
	};
	var Hi = class {
		constructor() {
			this._tokenizationSupports = /* @__PURE__ */ new Map(), this._factories = /* @__PURE__ */ new Map(), this._onDidChange = new ue(), this.onDidChange = this._onDidChange.event, this._colorMap = null;
		}
		handleChange(e) {
			this._onDidChange.fire({
				changedLanguages: e,
				changedColorMap: !1
			});
		}
		register(e, t) {
			return this._tokenizationSupports.set(e, t), this.handleChange([e]), at(() => {
				this._tokenizationSupports.get(e) === t && (this._tokenizationSupports.delete(e), this.handleChange([e]));
			});
		}
		get(e) {
			return this._tokenizationSupports.get(e) || null;
		}
		registerFactory(e, t) {
			this._factories.get(e)?.dispose();
			const n = new Wi(this, e, t);
			return this._factories.set(e, n), at(() => {
				const r = this._factories.get(e);
				!r || r !== n || (this._factories.delete(e), r.dispose());
			});
		}
		async getOrCreate(e) {
			const t = this.get(e);
			if (t) return t;
			const n = this._factories.get(e);
			return !n || n.isResolved ? null : (await n.resolve(), this.get(e));
		}
		isResolved(e) {
			if (this.get(e)) return !0;
			const t = this._factories.get(e);
			return !!(!t || t.isResolved);
		}
		setColorMap(e) {
			this._colorMap = e, this._onDidChange.fire({
				changedLanguages: Array.from(this._tokenizationSupports.keys()),
				changedColorMap: !0
			});
		}
		getColorMap() {
			return this._colorMap;
		}
		getDefaultBackground() {
			return this._colorMap && this._colorMap.length > 2 ? this._colorMap[2] : null;
		}
	}, Wi = class extends $e {
		get isResolved() {
			return this._isResolved;
		}
		constructor(e, t, n) {
			super(), this._registry = e, this._languageId = t, this._factory = n, this._isDisposed = !1, this._resolvePromise = null, this._isResolved = !1;
		}
		dispose() {
			this._isDisposed = !0, super.dispose();
		}
		async resolve() {
			return this._resolvePromise || (this._resolvePromise = this._create()), this._resolvePromise;
		}
		async _create() {
			const e = await this._factory.tokenizationSupport;
			this._isResolved = !0, e && !this._isDisposed && this._register(this._registry.register(this._languageId, e));
		}
	}, $i = class {
		constructor(e, t, n) {
			this.offset = e, this.type = t, this.language = n, this._tokenBrand = void 0;
		}
		toString() {
			return "(" + this.offset + ", " + this.type + ")";
		}
	}, rn;
	(function(e) {
		e[e.Increase = 0] = "Increase", e[e.Decrease = 1] = "Decrease";
	})(rn || (rn = {}));
	var sn;
	(function(e) {
		const t = /* @__PURE__ */ new Map();
		t.set(0, P.symbolMethod), t.set(1, P.symbolFunction), t.set(2, P.symbolConstructor), t.set(3, P.symbolField), t.set(4, P.symbolVariable), t.set(5, P.symbolClass), t.set(6, P.symbolStruct), t.set(7, P.symbolInterface), t.set(8, P.symbolModule), t.set(9, P.symbolProperty), t.set(10, P.symbolEvent), t.set(11, P.symbolOperator), t.set(12, P.symbolUnit), t.set(13, P.symbolValue), t.set(15, P.symbolEnum), t.set(14, P.symbolConstant), t.set(15, P.symbolEnum), t.set(16, P.symbolEnumMember), t.set(17, P.symbolKeyword), t.set(28, P.symbolSnippet), t.set(18, P.symbolText), t.set(19, P.symbolColor), t.set(20, P.symbolFile), t.set(21, P.symbolReference), t.set(22, P.symbolCustomColor), t.set(23, P.symbolFolder), t.set(24, P.symbolTypeParameter), t.set(25, P.account), t.set(26, P.issues), t.set(27, P.tools);
		function n(l) {
			let o = t.get(l);
			return o || (console.info("No codicon found for CompletionItemKind " + l), o = P.symbolProperty), o;
		}
		e.toIcon = n;
		function r(l) {
			switch (l) {
				case 0: return D(728, "Method");
				case 1: return D(729, "Function");
				case 2: return D(730, "Constructor");
				case 3: return D(731, "Field");
				case 4: return D(732, "Variable");
				case 5: return D(733, "Class");
				case 6: return D(734, "Struct");
				case 7: return D(735, "Interface");
				case 8: return D(736, "Module");
				case 9: return D(737, "Property");
				case 10: return D(738, "Event");
				case 11: return D(739, "Operator");
				case 12: return D(740, "Unit");
				case 13: return D(741, "Value");
				case 14: return D(742, "Constant");
				case 15: return D(743, "Enum");
				case 16: return D(744, "Enum Member");
				case 17: return D(745, "Keyword");
				case 18: return D(746, "Text");
				case 19: return D(747, "Color");
				case 20: return D(748, "File");
				case 21: return D(749, "Reference");
				case 22: return D(750, "Custom Color");
				case 23: return D(751, "Folder");
				case 24: return D(752, "Type Parameter");
				case 25: return D(753, "User");
				case 26: return D(754, "Issue");
				case 27: return D(755, "Tool");
				case 28: return D(756, "Snippet");
				default: return "";
			}
		}
		e.toLabel = r;
		const s = /* @__PURE__ */ new Map();
		s.set("method", 0), s.set("function", 1), s.set("constructor", 2), s.set("field", 3), s.set("variable", 4), s.set("class", 5), s.set("struct", 6), s.set("interface", 7), s.set("module", 8), s.set("property", 9), s.set("event", 10), s.set("operator", 11), s.set("unit", 12), s.set("value", 13), s.set("constant", 14), s.set("enum", 15), s.set("enum-member", 16), s.set("enumMember", 16), s.set("keyword", 17), s.set("snippet", 28), s.set("text", 18), s.set("color", 19), s.set("file", 20), s.set("reference", 21), s.set("customcolor", 22), s.set("folder", 23), s.set("type-parameter", 24), s.set("typeParameter", 24), s.set("account", 25), s.set("issue", 26), s.set("tool", 27);
		function a(l, o) {
			let u = s.get(l);
			return typeof u > "u" && !o && (u = 9), u;
		}
		e.fromString = a;
	})(sn || (sn = {}));
	var an;
	(function(e) {
		e[e.Automatic = 0] = "Automatic", e[e.Explicit = 1] = "Explicit";
	})(an || (an = {}));
	var ln;
	(function(e) {
		e[e.Code = 1] = "Code", e[e.Label = 2] = "Label";
	})(ln || (ln = {}));
	var on;
	(function(e) {
		e[e.Accepted = 0] = "Accepted", e[e.Rejected = 1] = "Rejected", e[e.Ignored = 2] = "Ignored";
	})(on || (on = {}));
	var un;
	(function(e) {
		e[e.Automatic = 0] = "Automatic", e[e.PasteAs = 1] = "PasteAs";
	})(un || (un = {}));
	var cn;
	(function(e) {
		e[e.Invoke = 1] = "Invoke", e[e.TriggerCharacter = 2] = "TriggerCharacter", e[e.ContentChange = 3] = "ContentChange";
	})(cn || (cn = {}));
	var hn;
	(function(e) {
		e[e.Text = 0] = "Text", e[e.Read = 1] = "Read", e[e.Write = 2] = "Write";
	})(hn || (hn = {}));
	D(757, "array"), D(758, "boolean"), D(759, "class"), D(760, "constant"), D(761, "constructor"), D(762, "enumeration"), D(763, "enumeration member"), D(764, "event"), D(765, "field"), D(766, "file"), D(767, "function"), D(768, "interface"), D(769, "key"), D(770, "method"), D(771, "module"), D(772, "namespace"), D(773, "null"), D(774, "number"), D(775, "object"), D(776, "operator"), D(777, "package"), D(778, "property"), D(779, "string"), D(780, "struct"), D(781, "type parameter"), D(782, "variable");
	var mn;
	(function(e) {
		const t = /* @__PURE__ */ new Map();
		t.set(0, P.symbolFile), t.set(1, P.symbolModule), t.set(2, P.symbolNamespace), t.set(3, P.symbolPackage), t.set(4, P.symbolClass), t.set(5, P.symbolMethod), t.set(6, P.symbolProperty), t.set(7, P.symbolField), t.set(8, P.symbolConstructor), t.set(9, P.symbolEnum), t.set(10, P.symbolInterface), t.set(11, P.symbolFunction), t.set(12, P.symbolVariable), t.set(13, P.symbolConstant), t.set(14, P.symbolString), t.set(15, P.symbolNumber), t.set(16, P.symbolBoolean), t.set(17, P.symbolArray), t.set(18, P.symbolObject), t.set(19, P.symbolKey), t.set(20, P.symbolNull), t.set(21, P.symbolEnumMember), t.set(22, P.symbolStruct), t.set(23, P.symbolEvent), t.set(24, P.symbolOperator), t.set(25, P.symbolTypeParameter);
		function n(a) {
			let l = t.get(a);
			return l || (console.info("No codicon found for SymbolKind " + a), l = P.symbolProperty), l;
		}
		e.toIcon = n;
		const r = /* @__PURE__ */ new Map();
		r.set(0, 20), r.set(1, 8), r.set(2, 8), r.set(3, 8), r.set(4, 5), r.set(5, 0), r.set(6, 9), r.set(7, 3), r.set(8, 2), r.set(9, 15), r.set(10, 7), r.set(11, 1), r.set(12, 4), r.set(13, 14), r.set(14, 18), r.set(15, 13), r.set(16, 13), r.set(17, 13), r.set(18, 13), r.set(19, 17), r.set(20, 13), r.set(21, 16), r.set(22, 6), r.set(23, 10), r.set(24, 11), r.set(25, 24);
		function s(a) {
			let l = r.get(a);
			return l === void 0 && (console.info("No completion kind found for SymbolKind " + a), l = 20), l;
		}
		e.toCompletionKind = s;
	})(mn || (mn = {}));
	(class ve {
		static #e = this.Comment = new ve("comment");
		static #t = this.Imports = new ve("imports");
		static #n = this.Region = new ve("region");
		static fromValue(t) {
			switch (t) {
				case "comment": return ve.Comment;
				case "imports": return ve.Imports;
				case "region": return ve.Region;
			}
			return new ve(t);
		}
		constructor(t) {
			this.value = t;
		}
	});
	var fn;
	(function(e) {
		e[e.AIGenerated = 1] = "AIGenerated";
	})(fn || (fn = {}));
	var gn;
	(function(e) {
		e[e.Invoke = 0] = "Invoke", e[e.Automatic = 1] = "Automatic";
	})(gn || (gn = {}));
	var dn;
	(function(e) {
		function t(n) {
			return !n || typeof n != "object" ? !1 : typeof n.id == "string" && typeof n.title == "string";
		}
		e.is = t;
	})(dn || (dn = {}));
	var pn;
	(function(e) {
		e[e.Type = 1] = "Type", e[e.Parameter = 2] = "Parameter";
	})(pn || (pn = {}));
	new Hi();
	var bn;
	(function(e) {
		e[e.Unknown = 0] = "Unknown", e[e.Disabled = 1] = "Disabled", e[e.Enabled = 2] = "Enabled";
	})(bn || (bn = {}));
	var wn;
	(function(e) {
		e[e.Invoke = 1] = "Invoke", e[e.Auto = 2] = "Auto";
	})(wn || (wn = {}));
	var yn;
	(function(e) {
		e[e.None = 0] = "None", e[e.KeepWhitespace = 1] = "KeepWhitespace", e[e.InsertAsSnippet = 4] = "InsertAsSnippet";
	})(yn || (yn = {}));
	var _n;
	(function(e) {
		e[e.Method = 0] = "Method", e[e.Function = 1] = "Function", e[e.Constructor = 2] = "Constructor", e[e.Field = 3] = "Field", e[e.Variable = 4] = "Variable", e[e.Class = 5] = "Class", e[e.Struct = 6] = "Struct", e[e.Interface = 7] = "Interface", e[e.Module = 8] = "Module", e[e.Property = 9] = "Property", e[e.Event = 10] = "Event", e[e.Operator = 11] = "Operator", e[e.Unit = 12] = "Unit", e[e.Value = 13] = "Value", e[e.Constant = 14] = "Constant", e[e.Enum = 15] = "Enum", e[e.EnumMember = 16] = "EnumMember", e[e.Keyword = 17] = "Keyword", e[e.Text = 18] = "Text", e[e.Color = 19] = "Color", e[e.File = 20] = "File", e[e.Reference = 21] = "Reference", e[e.Customcolor = 22] = "Customcolor", e[e.Folder = 23] = "Folder", e[e.TypeParameter = 24] = "TypeParameter", e[e.User = 25] = "User", e[e.Issue = 26] = "Issue", e[e.Tool = 27] = "Tool", e[e.Snippet = 28] = "Snippet";
	})(_n || (_n = {}));
	var vn;
	(function(e) {
		e[e.Deprecated = 1] = "Deprecated";
	})(vn || (vn = {}));
	var Ln;
	(function(e) {
		e[e.Invoke = 0] = "Invoke", e[e.TriggerCharacter = 1] = "TriggerCharacter", e[e.TriggerForIncompleteCompletions = 2] = "TriggerForIncompleteCompletions";
	})(Ln || (Ln = {}));
	var Nn;
	(function(e) {
		e[e.EXACT = 0] = "EXACT", e[e.ABOVE = 1] = "ABOVE", e[e.BELOW = 2] = "BELOW";
	})(Nn || (Nn = {}));
	var Sn;
	(function(e) {
		e[e.NotSet = 0] = "NotSet", e[e.ContentFlush = 1] = "ContentFlush", e[e.RecoverFromMarkers = 2] = "RecoverFromMarkers", e[e.Explicit = 3] = "Explicit", e[e.Paste = 4] = "Paste", e[e.Undo = 5] = "Undo", e[e.Redo = 6] = "Redo";
	})(Sn || (Sn = {}));
	var Rn;
	(function(e) {
		e[e.LF = 1] = "LF", e[e.CRLF = 2] = "CRLF";
	})(Rn || (Rn = {}));
	var An;
	(function(e) {
		e[e.Text = 0] = "Text", e[e.Read = 1] = "Read", e[e.Write = 2] = "Write";
	})(An || (An = {}));
	var Cn;
	(function(e) {
		e[e.None = 0] = "None", e[e.Keep = 1] = "Keep", e[e.Brackets = 2] = "Brackets", e[e.Advanced = 3] = "Advanced", e[e.Full = 4] = "Full";
	})(Cn || (Cn = {}));
	var xn;
	(function(e) {
		e[e.acceptSuggestionOnCommitCharacter = 0] = "acceptSuggestionOnCommitCharacter", e[e.acceptSuggestionOnEnter = 1] = "acceptSuggestionOnEnter", e[e.accessibilitySupport = 2] = "accessibilitySupport", e[e.accessibilityPageSize = 3] = "accessibilityPageSize", e[e.allowOverflow = 4] = "allowOverflow", e[e.allowVariableLineHeights = 5] = "allowVariableLineHeights", e[e.allowVariableFonts = 6] = "allowVariableFonts", e[e.allowVariableFontsInAccessibilityMode = 7] = "allowVariableFontsInAccessibilityMode", e[e.ariaLabel = 8] = "ariaLabel", e[e.ariaRequired = 9] = "ariaRequired", e[e.autoClosingBrackets = 10] = "autoClosingBrackets", e[e.autoClosingComments = 11] = "autoClosingComments", e[e.screenReaderAnnounceInlineSuggestion = 12] = "screenReaderAnnounceInlineSuggestion", e[e.autoClosingDelete = 13] = "autoClosingDelete", e[e.autoClosingOvertype = 14] = "autoClosingOvertype", e[e.autoClosingQuotes = 15] = "autoClosingQuotes", e[e.autoIndent = 16] = "autoIndent", e[e.autoIndentOnPaste = 17] = "autoIndentOnPaste", e[e.autoIndentOnPasteWithinString = 18] = "autoIndentOnPasteWithinString", e[e.automaticLayout = 19] = "automaticLayout", e[e.autoSurround = 20] = "autoSurround", e[e.bracketPairColorization = 21] = "bracketPairColorization", e[e.guides = 22] = "guides", e[e.codeLens = 23] = "codeLens", e[e.codeLensFontFamily = 24] = "codeLensFontFamily", e[e.codeLensFontSize = 25] = "codeLensFontSize", e[e.colorDecorators = 26] = "colorDecorators", e[e.colorDecoratorsLimit = 27] = "colorDecoratorsLimit", e[e.columnSelection = 28] = "columnSelection", e[e.comments = 29] = "comments", e[e.contextmenu = 30] = "contextmenu", e[e.copyWithSyntaxHighlighting = 31] = "copyWithSyntaxHighlighting", e[e.cursorBlinking = 32] = "cursorBlinking", e[e.cursorSmoothCaretAnimation = 33] = "cursorSmoothCaretAnimation", e[e.cursorStyle = 34] = "cursorStyle", e[e.cursorSurroundingLines = 35] = "cursorSurroundingLines", e[e.cursorSurroundingLinesStyle = 36] = "cursorSurroundingLinesStyle", e[e.cursorWidth = 37] = "cursorWidth", e[e.cursorHeight = 38] = "cursorHeight", e[e.disableLayerHinting = 39] = "disableLayerHinting", e[e.disableMonospaceOptimizations = 40] = "disableMonospaceOptimizations", e[e.domReadOnly = 41] = "domReadOnly", e[e.dragAndDrop = 42] = "dragAndDrop", e[e.dropIntoEditor = 43] = "dropIntoEditor", e[e.editContext = 44] = "editContext", e[e.emptySelectionClipboard = 45] = "emptySelectionClipboard", e[e.experimentalGpuAcceleration = 46] = "experimentalGpuAcceleration", e[e.experimentalWhitespaceRendering = 47] = "experimentalWhitespaceRendering", e[e.extraEditorClassName = 48] = "extraEditorClassName", e[e.fastScrollSensitivity = 49] = "fastScrollSensitivity", e[e.find = 50] = "find", e[e.fixedOverflowWidgets = 51] = "fixedOverflowWidgets", e[e.folding = 52] = "folding", e[e.foldingStrategy = 53] = "foldingStrategy", e[e.foldingHighlight = 54] = "foldingHighlight", e[e.foldingImportsByDefault = 55] = "foldingImportsByDefault", e[e.foldingMaximumRegions = 56] = "foldingMaximumRegions", e[e.unfoldOnClickAfterEndOfLine = 57] = "unfoldOnClickAfterEndOfLine", e[e.fontFamily = 58] = "fontFamily", e[e.fontInfo = 59] = "fontInfo", e[e.fontLigatures = 60] = "fontLigatures", e[e.fontSize = 61] = "fontSize", e[e.fontWeight = 62] = "fontWeight", e[e.fontVariations = 63] = "fontVariations", e[e.formatOnPaste = 64] = "formatOnPaste", e[e.formatOnType = 65] = "formatOnType", e[e.glyphMargin = 66] = "glyphMargin", e[e.gotoLocation = 67] = "gotoLocation", e[e.hideCursorInOverviewRuler = 68] = "hideCursorInOverviewRuler", e[e.hover = 69] = "hover", e[e.inDiffEditor = 70] = "inDiffEditor", e[e.inlineSuggest = 71] = "inlineSuggest", e[e.letterSpacing = 72] = "letterSpacing", e[e.lightbulb = 73] = "lightbulb", e[e.lineDecorationsWidth = 74] = "lineDecorationsWidth", e[e.lineHeight = 75] = "lineHeight", e[e.lineNumbers = 76] = "lineNumbers", e[e.lineNumbersMinChars = 77] = "lineNumbersMinChars", e[e.linkedEditing = 78] = "linkedEditing", e[e.links = 79] = "links", e[e.matchBrackets = 80] = "matchBrackets", e[e.minimap = 81] = "minimap", e[e.mouseStyle = 82] = "mouseStyle", e[e.mouseWheelScrollSensitivity = 83] = "mouseWheelScrollSensitivity", e[e.mouseWheelZoom = 84] = "mouseWheelZoom", e[e.multiCursorMergeOverlapping = 85] = "multiCursorMergeOverlapping", e[e.multiCursorModifier = 86] = "multiCursorModifier", e[e.mouseMiddleClickAction = 87] = "mouseMiddleClickAction", e[e.multiCursorPaste = 88] = "multiCursorPaste", e[e.multiCursorLimit = 89] = "multiCursorLimit", e[e.occurrencesHighlight = 90] = "occurrencesHighlight", e[e.occurrencesHighlightDelay = 91] = "occurrencesHighlightDelay", e[e.overtypeCursorStyle = 92] = "overtypeCursorStyle", e[e.overtypeOnPaste = 93] = "overtypeOnPaste", e[e.overviewRulerBorder = 94] = "overviewRulerBorder", e[e.overviewRulerLanes = 95] = "overviewRulerLanes", e[e.padding = 96] = "padding", e[e.pasteAs = 97] = "pasteAs", e[e.parameterHints = 98] = "parameterHints", e[e.peekWidgetDefaultFocus = 99] = "peekWidgetDefaultFocus", e[e.placeholder = 100] = "placeholder", e[e.definitionLinkOpensInPeek = 101] = "definitionLinkOpensInPeek", e[e.quickSuggestions = 102] = "quickSuggestions", e[e.quickSuggestionsDelay = 103] = "quickSuggestionsDelay", e[e.readOnly = 104] = "readOnly", e[e.readOnlyMessage = 105] = "readOnlyMessage", e[e.renameOnType = 106] = "renameOnType", e[e.renderRichScreenReaderContent = 107] = "renderRichScreenReaderContent", e[e.renderControlCharacters = 108] = "renderControlCharacters", e[e.renderFinalNewline = 109] = "renderFinalNewline", e[e.renderLineHighlight = 110] = "renderLineHighlight", e[e.renderLineHighlightOnlyWhenFocus = 111] = "renderLineHighlightOnlyWhenFocus", e[e.renderValidationDecorations = 112] = "renderValidationDecorations", e[e.renderWhitespace = 113] = "renderWhitespace", e[e.revealHorizontalRightPadding = 114] = "revealHorizontalRightPadding", e[e.roundedSelection = 115] = "roundedSelection", e[e.rulers = 116] = "rulers", e[e.scrollbar = 117] = "scrollbar", e[e.scrollBeyondLastColumn = 118] = "scrollBeyondLastColumn", e[e.scrollBeyondLastLine = 119] = "scrollBeyondLastLine", e[e.scrollPredominantAxis = 120] = "scrollPredominantAxis", e[e.selectionClipboard = 121] = "selectionClipboard", e[e.selectionHighlight = 122] = "selectionHighlight", e[e.selectionHighlightMaxLength = 123] = "selectionHighlightMaxLength", e[e.selectionHighlightMultiline = 124] = "selectionHighlightMultiline", e[e.selectOnLineNumbers = 125] = "selectOnLineNumbers", e[e.showFoldingControls = 126] = "showFoldingControls", e[e.showUnused = 127] = "showUnused", e[e.snippetSuggestions = 128] = "snippetSuggestions", e[e.smartSelect = 129] = "smartSelect", e[e.smoothScrolling = 130] = "smoothScrolling", e[e.stickyScroll = 131] = "stickyScroll", e[e.stickyTabStops = 132] = "stickyTabStops", e[e.stopRenderingLineAfter = 133] = "stopRenderingLineAfter", e[e.suggest = 134] = "suggest", e[e.suggestFontSize = 135] = "suggestFontSize", e[e.suggestLineHeight = 136] = "suggestLineHeight", e[e.suggestOnTriggerCharacters = 137] = "suggestOnTriggerCharacters", e[e.suggestSelection = 138] = "suggestSelection", e[e.tabCompletion = 139] = "tabCompletion", e[e.tabIndex = 140] = "tabIndex", e[e.trimWhitespaceOnDelete = 141] = "trimWhitespaceOnDelete", e[e.unicodeHighlighting = 142] = "unicodeHighlighting", e[e.unusualLineTerminators = 143] = "unusualLineTerminators", e[e.useShadowDOM = 144] = "useShadowDOM", e[e.useTabStops = 145] = "useTabStops", e[e.wordBreak = 146] = "wordBreak", e[e.wordSegmenterLocales = 147] = "wordSegmenterLocales", e[e.wordSeparators = 148] = "wordSeparators", e[e.wordWrap = 149] = "wordWrap", e[e.wordWrapBreakAfterCharacters = 150] = "wordWrapBreakAfterCharacters", e[e.wordWrapBreakBeforeCharacters = 151] = "wordWrapBreakBeforeCharacters", e[e.wordWrapColumn = 152] = "wordWrapColumn", e[e.wordWrapOverride1 = 153] = "wordWrapOverride1", e[e.wordWrapOverride2 = 154] = "wordWrapOverride2", e[e.wrappingIndent = 155] = "wrappingIndent", e[e.wrappingStrategy = 156] = "wrappingStrategy", e[e.showDeprecated = 157] = "showDeprecated", e[e.inertialScroll = 158] = "inertialScroll", e[e.inlayHints = 159] = "inlayHints", e[e.wrapOnEscapedLineFeeds = 160] = "wrapOnEscapedLineFeeds", e[e.effectiveCursorStyle = 161] = "effectiveCursorStyle", e[e.editorClassName = 162] = "editorClassName", e[e.pixelRatio = 163] = "pixelRatio", e[e.tabFocusMode = 164] = "tabFocusMode", e[e.layoutInfo = 165] = "layoutInfo", e[e.wrappingInfo = 166] = "wrappingInfo", e[e.defaultColorDecorators = 167] = "defaultColorDecorators", e[e.colorDecoratorsActivatedOn = 168] = "colorDecoratorsActivatedOn", e[e.inlineCompletionsAccessibilityVerbose = 169] = "inlineCompletionsAccessibilityVerbose", e[e.effectiveEditContext = 170] = "effectiveEditContext", e[e.scrollOnMiddleClick = 171] = "scrollOnMiddleClick", e[e.effectiveAllowVariableFonts = 172] = "effectiveAllowVariableFonts";
	})(xn || (xn = {}));
	var kn;
	(function(e) {
		e[e.TextDefined = 0] = "TextDefined", e[e.LF = 1] = "LF", e[e.CRLF = 2] = "CRLF";
	})(kn || (kn = {}));
	var Mn;
	(function(e) {
		e[e.LF = 0] = "LF", e[e.CRLF = 1] = "CRLF";
	})(Mn || (Mn = {}));
	var En;
	(function(e) {
		e[e.Left = 1] = "Left", e[e.Center = 2] = "Center", e[e.Right = 3] = "Right";
	})(En || (En = {}));
	var Pn;
	(function(e) {
		e[e.Increase = 0] = "Increase", e[e.Decrease = 1] = "Decrease";
	})(Pn || (Pn = {}));
	var Dn;
	(function(e) {
		e[e.None = 0] = "None", e[e.Indent = 1] = "Indent", e[e.IndentOutdent = 2] = "IndentOutdent", e[e.Outdent = 3] = "Outdent";
	})(Dn || (Dn = {}));
	var Tn;
	(function(e) {
		e[e.Both = 0] = "Both", e[e.Right = 1] = "Right", e[e.Left = 2] = "Left", e[e.None = 3] = "None";
	})(Tn || (Tn = {}));
	var Fn;
	(function(e) {
		e[e.Type = 1] = "Type", e[e.Parameter = 2] = "Parameter";
	})(Fn || (Fn = {}));
	var In;
	(function(e) {
		e[e.Accepted = 0] = "Accepted", e[e.Rejected = 1] = "Rejected", e[e.Ignored = 2] = "Ignored";
	})(In || (In = {}));
	var Vn;
	(function(e) {
		e[e.Code = 1] = "Code", e[e.Label = 2] = "Label";
	})(Vn || (Vn = {}));
	var Bn;
	(function(e) {
		e[e.Automatic = 0] = "Automatic", e[e.Explicit = 1] = "Explicit";
	})(Bn || (Bn = {}));
	var r1;
	(function(e) {
		e[e.DependsOnKbLayout = -1] = "DependsOnKbLayout", e[e.Unknown = 0] = "Unknown", e[e.Backspace = 1] = "Backspace", e[e.Tab = 2] = "Tab", e[e.Enter = 3] = "Enter", e[e.Shift = 4] = "Shift", e[e.Ctrl = 5] = "Ctrl", e[e.Alt = 6] = "Alt", e[e.PauseBreak = 7] = "PauseBreak", e[e.CapsLock = 8] = "CapsLock", e[e.Escape = 9] = "Escape", e[e.Space = 10] = "Space", e[e.PageUp = 11] = "PageUp", e[e.PageDown = 12] = "PageDown", e[e.End = 13] = "End", e[e.Home = 14] = "Home", e[e.LeftArrow = 15] = "LeftArrow", e[e.UpArrow = 16] = "UpArrow", e[e.RightArrow = 17] = "RightArrow", e[e.DownArrow = 18] = "DownArrow", e[e.Insert = 19] = "Insert", e[e.Delete = 20] = "Delete", e[e.Digit0 = 21] = "Digit0", e[e.Digit1 = 22] = "Digit1", e[e.Digit2 = 23] = "Digit2", e[e.Digit3 = 24] = "Digit3", e[e.Digit4 = 25] = "Digit4", e[e.Digit5 = 26] = "Digit5", e[e.Digit6 = 27] = "Digit6", e[e.Digit7 = 28] = "Digit7", e[e.Digit8 = 29] = "Digit8", e[e.Digit9 = 30] = "Digit9", e[e.KeyA = 31] = "KeyA", e[e.KeyB = 32] = "KeyB", e[e.KeyC = 33] = "KeyC", e[e.KeyD = 34] = "KeyD", e[e.KeyE = 35] = "KeyE", e[e.KeyF = 36] = "KeyF", e[e.KeyG = 37] = "KeyG", e[e.KeyH = 38] = "KeyH", e[e.KeyI = 39] = "KeyI", e[e.KeyJ = 40] = "KeyJ", e[e.KeyK = 41] = "KeyK", e[e.KeyL = 42] = "KeyL", e[e.KeyM = 43] = "KeyM", e[e.KeyN = 44] = "KeyN", e[e.KeyO = 45] = "KeyO", e[e.KeyP = 46] = "KeyP", e[e.KeyQ = 47] = "KeyQ", e[e.KeyR = 48] = "KeyR", e[e.KeyS = 49] = "KeyS", e[e.KeyT = 50] = "KeyT", e[e.KeyU = 51] = "KeyU", e[e.KeyV = 52] = "KeyV", e[e.KeyW = 53] = "KeyW", e[e.KeyX = 54] = "KeyX", e[e.KeyY = 55] = "KeyY", e[e.KeyZ = 56] = "KeyZ", e[e.Meta = 57] = "Meta", e[e.ContextMenu = 58] = "ContextMenu", e[e.F1 = 59] = "F1", e[e.F2 = 60] = "F2", e[e.F3 = 61] = "F3", e[e.F4 = 62] = "F4", e[e.F5 = 63] = "F5", e[e.F6 = 64] = "F6", e[e.F7 = 65] = "F7", e[e.F8 = 66] = "F8", e[e.F9 = 67] = "F9", e[e.F10 = 68] = "F10", e[e.F11 = 69] = "F11", e[e.F12 = 70] = "F12", e[e.F13 = 71] = "F13", e[e.F14 = 72] = "F14", e[e.F15 = 73] = "F15", e[e.F16 = 74] = "F16", e[e.F17 = 75] = "F17", e[e.F18 = 76] = "F18", e[e.F19 = 77] = "F19", e[e.F20 = 78] = "F20", e[e.F21 = 79] = "F21", e[e.F22 = 80] = "F22", e[e.F23 = 81] = "F23", e[e.F24 = 82] = "F24", e[e.NumLock = 83] = "NumLock", e[e.ScrollLock = 84] = "ScrollLock", e[e.Semicolon = 85] = "Semicolon", e[e.Equal = 86] = "Equal", e[e.Comma = 87] = "Comma", e[e.Minus = 88] = "Minus", e[e.Period = 89] = "Period", e[e.Slash = 90] = "Slash", e[e.Backquote = 91] = "Backquote", e[e.BracketLeft = 92] = "BracketLeft", e[e.Backslash = 93] = "Backslash", e[e.BracketRight = 94] = "BracketRight", e[e.Quote = 95] = "Quote", e[e.OEM_8 = 96] = "OEM_8", e[e.IntlBackslash = 97] = "IntlBackslash", e[e.Numpad0 = 98] = "Numpad0", e[e.Numpad1 = 99] = "Numpad1", e[e.Numpad2 = 100] = "Numpad2", e[e.Numpad3 = 101] = "Numpad3", e[e.Numpad4 = 102] = "Numpad4", e[e.Numpad5 = 103] = "Numpad5", e[e.Numpad6 = 104] = "Numpad6", e[e.Numpad7 = 105] = "Numpad7", e[e.Numpad8 = 106] = "Numpad8", e[e.Numpad9 = 107] = "Numpad9", e[e.NumpadMultiply = 108] = "NumpadMultiply", e[e.NumpadAdd = 109] = "NumpadAdd", e[e.NUMPAD_SEPARATOR = 110] = "NUMPAD_SEPARATOR", e[e.NumpadSubtract = 111] = "NumpadSubtract", e[e.NumpadDecimal = 112] = "NumpadDecimal", e[e.NumpadDivide = 113] = "NumpadDivide", e[e.KEY_IN_COMPOSITION = 114] = "KEY_IN_COMPOSITION", e[e.ABNT_C1 = 115] = "ABNT_C1", e[e.ABNT_C2 = 116] = "ABNT_C2", e[e.AudioVolumeMute = 117] = "AudioVolumeMute", e[e.AudioVolumeUp = 118] = "AudioVolumeUp", e[e.AudioVolumeDown = 119] = "AudioVolumeDown", e[e.BrowserSearch = 120] = "BrowserSearch", e[e.BrowserHome = 121] = "BrowserHome", e[e.BrowserBack = 122] = "BrowserBack", e[e.BrowserForward = 123] = "BrowserForward", e[e.MediaTrackNext = 124] = "MediaTrackNext", e[e.MediaTrackPrevious = 125] = "MediaTrackPrevious", e[e.MediaStop = 126] = "MediaStop", e[e.MediaPlayPause = 127] = "MediaPlayPause", e[e.LaunchMediaPlayer = 128] = "LaunchMediaPlayer", e[e.LaunchMail = 129] = "LaunchMail", e[e.LaunchApp2 = 130] = "LaunchApp2", e[e.Clear = 131] = "Clear", e[e.MAX_VALUE = 132] = "MAX_VALUE";
	})(r1 || (r1 = {}));
	var s1;
	(function(e) {
		e[e.Hint = 1] = "Hint", e[e.Info = 2] = "Info", e[e.Warning = 4] = "Warning", e[e.Error = 8] = "Error";
	})(s1 || (s1 = {}));
	var i1;
	(function(e) {
		e[e.Unnecessary = 1] = "Unnecessary", e[e.Deprecated = 2] = "Deprecated";
	})(i1 || (i1 = {}));
	var qn;
	(function(e) {
		e[e.Inline = 1] = "Inline", e[e.Gutter = 2] = "Gutter";
	})(qn || (qn = {}));
	var Un;
	(function(e) {
		e[e.Normal = 1] = "Normal", e[e.Underlined = 2] = "Underlined";
	})(Un || (Un = {}));
	var Hn;
	(function(e) {
		e[e.UNKNOWN = 0] = "UNKNOWN", e[e.TEXTAREA = 1] = "TEXTAREA", e[e.GUTTER_GLYPH_MARGIN = 2] = "GUTTER_GLYPH_MARGIN", e[e.GUTTER_LINE_NUMBERS = 3] = "GUTTER_LINE_NUMBERS", e[e.GUTTER_LINE_DECORATIONS = 4] = "GUTTER_LINE_DECORATIONS", e[e.GUTTER_VIEW_ZONE = 5] = "GUTTER_VIEW_ZONE", e[e.CONTENT_TEXT = 6] = "CONTENT_TEXT", e[e.CONTENT_EMPTY = 7] = "CONTENT_EMPTY", e[e.CONTENT_VIEW_ZONE = 8] = "CONTENT_VIEW_ZONE", e[e.CONTENT_WIDGET = 9] = "CONTENT_WIDGET", e[e.OVERVIEW_RULER = 10] = "OVERVIEW_RULER", e[e.SCROLLBAR = 11] = "SCROLLBAR", e[e.OVERLAY_WIDGET = 12] = "OVERLAY_WIDGET", e[e.OUTSIDE_EDITOR = 13] = "OUTSIDE_EDITOR";
	})(Hn || (Hn = {}));
	var Wn;
	(function(e) {
		e[e.AIGenerated = 1] = "AIGenerated";
	})(Wn || (Wn = {}));
	var $n;
	(function(e) {
		e[e.Invoke = 0] = "Invoke", e[e.Automatic = 1] = "Automatic";
	})($n || ($n = {}));
	var zn;
	(function(e) {
		e[e.TOP_RIGHT_CORNER = 0] = "TOP_RIGHT_CORNER", e[e.BOTTOM_RIGHT_CORNER = 1] = "BOTTOM_RIGHT_CORNER", e[e.TOP_CENTER = 2] = "TOP_CENTER";
	})(zn || (zn = {}));
	var On;
	(function(e) {
		e[e.Left = 1] = "Left", e[e.Center = 2] = "Center", e[e.Right = 4] = "Right", e[e.Full = 7] = "Full";
	})(On || (On = {}));
	var Gn;
	(function(e) {
		e[e.Word = 0] = "Word", e[e.Line = 1] = "Line", e[e.Suggest = 2] = "Suggest";
	})(Gn || (Gn = {}));
	var jn;
	(function(e) {
		e[e.Left = 0] = "Left", e[e.Right = 1] = "Right", e[e.None = 2] = "None", e[e.LeftOfInjectedText = 3] = "LeftOfInjectedText", e[e.RightOfInjectedText = 4] = "RightOfInjectedText";
	})(jn || (jn = {}));
	var Xn;
	(function(e) {
		e[e.Off = 0] = "Off", e[e.On = 1] = "On", e[e.Relative = 2] = "Relative", e[e.Interval = 3] = "Interval", e[e.Custom = 4] = "Custom";
	})(Xn || (Xn = {}));
	var Qn;
	(function(e) {
		e[e.None = 0] = "None", e[e.Text = 1] = "Text", e[e.Blocks = 2] = "Blocks";
	})(Qn || (Qn = {}));
	var Yn;
	(function(e) {
		e[e.Smooth = 0] = "Smooth", e[e.Immediate = 1] = "Immediate";
	})(Yn || (Yn = {}));
	var Jn;
	(function(e) {
		e[e.Auto = 1] = "Auto", e[e.Hidden = 2] = "Hidden", e[e.Visible = 3] = "Visible";
	})(Jn || (Jn = {}));
	var a1;
	(function(e) {
		e[e.LTR = 0] = "LTR", e[e.RTL = 1] = "RTL";
	})(a1 || (a1 = {}));
	var Zn;
	(function(e) {
		e.Off = "off", e.OnCode = "onCode", e.On = "on";
	})(Zn || (Zn = {}));
	var Kn;
	(function(e) {
		e[e.Invoke = 1] = "Invoke", e[e.TriggerCharacter = 2] = "TriggerCharacter", e[e.ContentChange = 3] = "ContentChange";
	})(Kn || (Kn = {}));
	var er;
	(function(e) {
		e[e.File = 0] = "File", e[e.Module = 1] = "Module", e[e.Namespace = 2] = "Namespace", e[e.Package = 3] = "Package", e[e.Class = 4] = "Class", e[e.Method = 5] = "Method", e[e.Property = 6] = "Property", e[e.Field = 7] = "Field", e[e.Constructor = 8] = "Constructor", e[e.Enum = 9] = "Enum", e[e.Interface = 10] = "Interface", e[e.Function = 11] = "Function", e[e.Variable = 12] = "Variable", e[e.Constant = 13] = "Constant", e[e.String = 14] = "String", e[e.Number = 15] = "Number", e[e.Boolean = 16] = "Boolean", e[e.Array = 17] = "Array", e[e.Object = 18] = "Object", e[e.Key = 19] = "Key", e[e.Null = 20] = "Null", e[e.EnumMember = 21] = "EnumMember", e[e.Struct = 22] = "Struct", e[e.Event = 23] = "Event", e[e.Operator = 24] = "Operator", e[e.TypeParameter = 25] = "TypeParameter";
	})(er || (er = {}));
	var tr;
	(function(e) {
		e[e.Deprecated = 1] = "Deprecated";
	})(tr || (tr = {}));
	var nr;
	(function(e) {
		e[e.LTR = 0] = "LTR", e[e.RTL = 1] = "RTL";
	})(nr || (nr = {}));
	var rr;
	(function(e) {
		e[e.Hidden = 0] = "Hidden", e[e.Blink = 1] = "Blink", e[e.Smooth = 2] = "Smooth", e[e.Phase = 3] = "Phase", e[e.Expand = 4] = "Expand", e[e.Solid = 5] = "Solid";
	})(rr || (rr = {}));
	var sr;
	(function(e) {
		e[e.Line = 1] = "Line", e[e.Block = 2] = "Block", e[e.Underline = 3] = "Underline", e[e.LineThin = 4] = "LineThin", e[e.BlockOutline = 5] = "BlockOutline", e[e.UnderlineThin = 6] = "UnderlineThin";
	})(sr || (sr = {}));
	var ir;
	(function(e) {
		e[e.AlwaysGrowsWhenTypingAtEdges = 0] = "AlwaysGrowsWhenTypingAtEdges", e[e.NeverGrowsWhenTypingAtEdges = 1] = "NeverGrowsWhenTypingAtEdges", e[e.GrowsOnlyWhenTypingBefore = 2] = "GrowsOnlyWhenTypingBefore", e[e.GrowsOnlyWhenTypingAfter = 3] = "GrowsOnlyWhenTypingAfter";
	})(ir || (ir = {}));
	var ar;
	(function(e) {
		e[e.None = 0] = "None", e[e.Same = 1] = "Same", e[e.Indent = 2] = "Indent", e[e.DeepIndent = 3] = "DeepIndent";
	})(ar || (ar = {}));
	var zi = class {
		static #e = this.CtrlCmd = 2048;
		static #t = this.Shift = 1024;
		static #n = this.Alt = 512;
		static #r = this.WinCtrl = 256;
		static chord(e, t) {
			return yi(e, t);
		}
	};
	function Oi() {
		return {
			editor: void 0,
			languages: void 0,
			CancellationTokenSource: di,
			Emitter: ue,
			KeyCode: r1,
			KeyMod: zi,
			Position: W,
			Range: I,
			Selection: Bi,
			SelectionDirection: a1,
			MarkerSeverity: s1,
			MarkerTag: i1,
			Uri: e1,
			Token: $i
		};
	}
	var lr, ur, Gi = class {
		constructor(e, t) {
			this.uri = e, this.value = t;
		}
	};
	function ji(e) {
		return Array.isArray(e);
	}
	(class tt {
		static #e = this.defaultToKey = (t) => t.toString();
		constructor(t, n) {
			if (this[lr] = "ResourceMap", t instanceof tt) this.map = new Map(t.map), this.toKey = n ?? tt.defaultToKey;
			else if (ji(t)) {
				this.map = /* @__PURE__ */ new Map(), this.toKey = n ?? tt.defaultToKey;
				for (const [r, s] of t) this.set(r, s);
			} else this.map = /* @__PURE__ */ new Map(), this.toKey = t ?? tt.defaultToKey;
		}
		set(t, n) {
			return this.map.set(this.toKey(t), new Gi(t, n)), this;
		}
		get(t) {
			return this.map.get(this.toKey(t))?.value;
		}
		has(t) {
			return this.map.has(this.toKey(t));
		}
		get size() {
			return this.map.size;
		}
		clear() {
			this.map.clear();
		}
		delete(t) {
			return this.map.delete(this.toKey(t));
		}
		forEach(t, n) {
			typeof n < "u" && (t = t.bind(n));
			for (const [r, s] of this.map) t(s.value, s.uri, this);
		}
		*values() {
			for (const t of this.map.values()) yield t.value;
		}
		*keys() {
			for (const t of this.map.values()) yield t.uri;
		}
		*entries() {
			for (const t of this.map.values()) yield [t.uri, t.value];
		}
		*[(lr = Symbol.toStringTag, Symbol.iterator)]() {
			for (const [, t] of this.map) yield [t.uri, t.value];
		}
	});
	var Xi = class {
		constructor() {
			this[ur] = "LinkedMap", this._map = /* @__PURE__ */ new Map(), this._head = void 0, this._tail = void 0, this._size = 0, this._state = 0;
		}
		clear() {
			this._map.clear(), this._head = void 0, this._tail = void 0, this._size = 0, this._state++;
		}
		isEmpty() {
			return !this._head && !this._tail;
		}
		get size() {
			return this._size;
		}
		get first() {
			return this._head?.value;
		}
		get last() {
			return this._tail?.value;
		}
		has(e) {
			return this._map.has(e);
		}
		get(e, t = 0) {
			const n = this._map.get(e);
			if (n) return t !== 0 && this.touch(n, t), n.value;
		}
		set(e, t, n = 0) {
			let r = this._map.get(e);
			if (r) r.value = t, n !== 0 && this.touch(r, n);
			else {
				switch (r = {
					key: e,
					value: t,
					next: void 0,
					previous: void 0
				}, n) {
					case 0:
						this.addItemLast(r);
						break;
					case 1:
						this.addItemFirst(r);
						break;
					case 2:
						this.addItemLast(r);
						break;
					default:
						this.addItemLast(r);
						break;
				}
				this._map.set(e, r), this._size++;
			}
			return this;
		}
		delete(e) {
			return !!this.remove(e);
		}
		remove(e) {
			const t = this._map.get(e);
			if (t) return this._map.delete(e), this.removeItem(t), this._size--, t.value;
		}
		shift() {
			if (!this._head && !this._tail) return;
			if (!this._head || !this._tail) throw new Error("Invalid list");
			const e = this._head;
			return this._map.delete(e.key), this.removeItem(e), this._size--, e.value;
		}
		forEach(e, t) {
			const n = this._state;
			let r = this._head;
			for (; r;) {
				if (t ? e.bind(t)(r.value, r.key, this) : e(r.value, r.key, this), this._state !== n) throw new Error("LinkedMap got modified during iteration.");
				r = r.next;
			}
		}
		keys() {
			const e = this, t = this._state;
			let n = this._head;
			const r = {
				[Symbol.iterator]() {
					return r;
				},
				next() {
					if (e._state !== t) throw new Error("LinkedMap got modified during iteration.");
					if (n) {
						const s = {
							value: n.key,
							done: !1
						};
						return n = n.next, s;
					} else return {
						value: void 0,
						done: !0
					};
				}
			};
			return r;
		}
		values() {
			const e = this, t = this._state;
			let n = this._head;
			const r = {
				[Symbol.iterator]() {
					return r;
				},
				next() {
					if (e._state !== t) throw new Error("LinkedMap got modified during iteration.");
					if (n) {
						const s = {
							value: n.value,
							done: !1
						};
						return n = n.next, s;
					} else return {
						value: void 0,
						done: !0
					};
				}
			};
			return r;
		}
		entries() {
			const e = this, t = this._state;
			let n = this._head;
			const r = {
				[Symbol.iterator]() {
					return r;
				},
				next() {
					if (e._state !== t) throw new Error("LinkedMap got modified during iteration.");
					if (n) {
						const s = {
							value: [n.key, n.value],
							done: !1
						};
						return n = n.next, s;
					} else return {
						value: void 0,
						done: !0
					};
				}
			};
			return r;
		}
		[(ur = Symbol.toStringTag, Symbol.iterator)]() {
			return this.entries();
		}
		trimOld(e) {
			if (e >= this.size) return;
			if (e === 0) {
				this.clear();
				return;
			}
			let t = this._head, n = this.size;
			for (; t && n > e;) this._map.delete(t.key), t = t.next, n--;
			this._head = t, this._size = n, t && (t.previous = void 0), this._state++;
		}
		trimNew(e) {
			if (e >= this.size) return;
			if (e === 0) {
				this.clear();
				return;
			}
			let t = this._tail, n = this.size;
			for (; t && n > e;) this._map.delete(t.key), t = t.previous, n--;
			this._tail = t, this._size = n, t && (t.next = void 0), this._state++;
		}
		addItemFirst(e) {
			if (!this._head && !this._tail) this._tail = e;
			else if (this._head) e.next = this._head, this._head.previous = e;
			else throw new Error("Invalid list");
			this._head = e, this._state++;
		}
		addItemLast(e) {
			if (!this._head && !this._tail) this._head = e;
			else if (this._tail) e.previous = this._tail, this._tail.next = e;
			else throw new Error("Invalid list");
			this._tail = e, this._state++;
		}
		removeItem(e) {
			if (e === this._head && e === this._tail) this._head = void 0, this._tail = void 0;
			else if (e === this._head) {
				if (!e.next) throw new Error("Invalid list");
				e.next.previous = void 0, this._head = e.next;
			} else if (e === this._tail) {
				if (!e.previous) throw new Error("Invalid list");
				e.previous.next = void 0, this._tail = e.previous;
			} else {
				const t = e.next, n = e.previous;
				if (!t || !n) throw new Error("Invalid list");
				t.previous = n, n.next = t;
			}
			e.next = void 0, e.previous = void 0, this._state++;
		}
		touch(e, t) {
			if (!this._head || !this._tail) throw new Error("Invalid list");
			if (!(t !== 1 && t !== 2)) {
				if (t === 1) {
					if (e === this._head) return;
					const n = e.next, r = e.previous;
					e === this._tail ? (r.next = void 0, this._tail = r) : (n.previous = r, r.next = n), e.previous = void 0, e.next = this._head, this._head.previous = e, this._head = e, this._state++;
				} else if (t === 2) {
					if (e === this._tail) return;
					const n = e.next, r = e.previous;
					e === this._head ? (n.previous = void 0, this._head = n) : (n.previous = r, r.next = n), e.next = void 0, e.previous = this._tail, this._tail.next = e, this._tail = e, this._state++;
				}
			}
		}
		toJSON() {
			const e = [];
			return this.forEach((t, n) => {
				e.push([n, t]);
			}), e;
		}
		fromJSON(e) {
			this.clear();
			for (const [t, n] of e) this.set(t, n);
		}
	}, Qi = class extends Xi {
		constructor(e, t = 1) {
			super(), this._limit = e, this._ratio = Math.min(Math.max(0, t), 1);
		}
		get limit() {
			return this._limit;
		}
		set limit(e) {
			this._limit = e, this.checkTrim();
		}
		get(e, t = 2) {
			return super.get(e, t);
		}
		peek(e) {
			return super.get(e, 0);
		}
		set(e, t) {
			return super.set(e, t, 2), this;
		}
		checkTrim() {
			this.size > this._limit && this.trim(Math.round(this._limit * this._ratio));
		}
	}, Yi = class extends Qi {
		constructor(e, t = 1) {
			super(e, t);
		}
		trim(e) {
			this.trimOld(e);
		}
		set(e, t) {
			return super.set(e, t), this.checkTrim(), this;
		}
	}, Ji = class {
		constructor() {
			this.map = /* @__PURE__ */ new Map();
		}
		add(e, t) {
			let n = this.map.get(e);
			n || (n = /* @__PURE__ */ new Set(), this.map.set(e, n)), n.add(t);
		}
		delete(e, t) {
			const n = this.map.get(e);
			n && (n.delete(t), n.size === 0 && this.map.delete(e));
		}
		forEach(e, t) {
			const n = this.map.get(e);
			n && n.forEach(t);
		}
	};
	new Yi(10);
	var hr;
	(function(e) {
		e[e.Left = 1] = "Left", e[e.Center = 2] = "Center", e[e.Right = 4] = "Right", e[e.Full = 7] = "Full";
	})(hr || (hr = {}));
	var mr;
	(function(e) {
		e[e.Left = 1] = "Left", e[e.Center = 2] = "Center", e[e.Right = 3] = "Right";
	})(mr || (mr = {}));
	var fr;
	(function(e) {
		e[e.LTR = 0] = "LTR", e[e.RTL = 1] = "RTL";
	})(fr || (fr = {}));
	var gr;
	(function(e) {
		e[e.Both = 0] = "Both", e[e.Right = 1] = "Right", e[e.Left = 2] = "Left", e[e.None = 3] = "None";
	})(gr || (gr = {}));
	function Zi(e) {
		if (!e || e.length === 0) return !1;
		for (let t = 0, n = e.length; t < n; t++) {
			const r = e.charCodeAt(t);
			if (r === 10) return !0;
			if (r === 92) {
				if (t++, t >= n) break;
				const s = e.charCodeAt(t);
				if (s === 110 || s === 114 || s === 87) return !0;
			}
		}
		return !1;
	}
	function Ki(e, t, n, r, s) {
		if (r === 0) return !0;
		const a = t.charCodeAt(r - 1);
		if (e.get(a) !== 0 || a === 13 || a === 10) return !0;
		if (s > 0) {
			const l = t.charCodeAt(r);
			if (e.get(l) !== 0) return !0;
		}
		return !1;
	}
	function ea(e, t, n, r, s) {
		if (r + s === n) return !0;
		const a = t.charCodeAt(r + s);
		if (e.get(a) !== 0 || a === 13 || a === 10) return !0;
		if (s > 0) {
			const l = t.charCodeAt(r + s - 1);
			if (e.get(l) !== 0) return !0;
		}
		return !1;
	}
	function ta(e, t, n, r, s) {
		return Ki(e, t, n, r, s) && ea(e, t, n, r, s);
	}
	var na = class {
		constructor(e, t) {
			this._wordSeparators = e, this._searchRegex = t, this._prevMatchStartIndex = -1, this._prevMatchLength = 0;
		}
		reset(e) {
			this._searchRegex.lastIndex = e, this._prevMatchStartIndex = -1, this._prevMatchLength = 0;
		}
		next(e) {
			const t = e.length;
			let n;
			do {
				if (this._prevMatchStartIndex + this._prevMatchLength === t || (n = this._searchRegex.exec(e), !n)) return null;
				const r = n.index, s = n[0].length;
				if (r === this._prevMatchStartIndex && s === this._prevMatchLength) {
					if (s === 0) {
						Os(e, t, this._searchRegex.lastIndex) > 65535 ? this._searchRegex.lastIndex += 2 : this._searchRegex.lastIndex += 1;
						continue;
					}
					return null;
				}
				if (this._prevMatchStartIndex = r, this._prevMatchLength = s, !this._wordSeparators || ta(this._wordSeparators, e, t, r, s)) return n;
			} while (n);
			return null;
		}
	};
	const ra = "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?";
	function sa(e = "") {
		let t = "(-?\\d*\\.\\d\\w*)|([^";
		for (const n of ra) e.indexOf(n) >= 0 || (t += "\\" + n);
		return t += "\\s]+)", new RegExp(t, "g");
	}
	const dr = sa();
	function pr(e) {
		let t = dr;
		if (e && e instanceof RegExp) if (e.global) t = e;
		else {
			let n = "g";
			e.ignoreCase && (n += "i"), e.multiline && (n += "m"), e.unicode && (n += "u"), t = new RegExp(e.source, n);
		}
		return t.lastIndex = 0, t;
	}
	const br = new ds();
	br.unshift({
		maxLen: 1e3,
		windowSize: 15,
		timeBudget: 150
	});
	function l1(e, t, n, r, s) {
		if (t = pr(t), s || (s = it.first(br)), n.length > s.maxLen) {
			let c = e - s.maxLen / 2;
			return c < 0 ? c = 0 : r += c, n = n.substring(c, e + s.maxLen / 2), l1(e, t, n, r, s);
		}
		const a = Date.now(), l = e - 1 - r;
		let o = -1, u = null;
		for (let c = 1; !(Date.now() - a >= s.timeBudget); c++) {
			const m = l - s.windowSize * c;
			t.lastIndex = Math.max(0, m);
			const h = ia(t, n, l, o);
			if (!h && u || (u = h, m <= 0)) break;
			o = m;
		}
		if (u) {
			const c = {
				word: u[0],
				startColumn: r + 1 + u.index,
				endColumn: r + 1 + u.index + u[0].length
			};
			return t.lastIndex = 0, c;
		}
		return null;
	}
	function ia(e, t, n, r) {
		let s;
		for (; s = e.exec(t);) {
			const a = s.index || 0;
			if (a <= n && e.lastIndex >= n) return s;
			if (r > 0 && a > r) return null;
		}
		return null;
	}
	var aa = class {
		static computeUnicodeHighlights(e, t, n) {
			const r = n ? n.startLineNumber : 1, s = n ? n.endLineNumber : e.getLineCount(), a = new wr(t), l = a.getCandidateCodePoints();
			let o;
			l === "allNonBasicAscii" ? o = /* @__PURE__ */ new RegExp("[^\\t\\n\\r\\x20-\\x7E]", "g") : o = new RegExp(`${la(Array.from(l))}`, "g");
			const u = new na(null, o), c = [];
			let m = !1, h, d = 0, f = 0, b = 0;
			e: for (let p = r, y = s; p <= y; p++) {
				const v = e.getLineContent(p), L = v.length;
				u.reset(0);
				do
					if (h = u.next(v), h) {
						let _ = h.index, N = h.index + h[0].length;
						_ > 0 && ct(v.charCodeAt(_ - 1)) && _--, N + 1 < L && ct(v.charCodeAt(N - 1)) && N++;
						const k = v.substring(_, N);
						let M = l1(_ + 1, dr, v, 0);
						M && M.endColumn <= _ + 1 && (M = null);
						const w = a.shouldHighlightNonBasicASCII(k, M ? M.word : null);
						if (w !== 0) {
							if (w === 3 ? d++ : w === 2 ? f++ : w === 1 ? b++ : us(), c.length >= 1e3) {
								m = !0;
								break e;
							}
							c.push(new I(p, _ + 1, p, N + 1));
						}
					}
				while (h);
			}
			return {
				ranges: c,
				hasMore: m,
				ambiguousCharacterCount: d,
				invisibleCharacterCount: f,
				nonBasicAsciiCharacterCount: b
			};
		}
		static computeUnicodeHighlightReason(e, t) {
			const n = new wr(t);
			switch (n.shouldHighlightNonBasicASCII(e, null)) {
				case 0: return null;
				case 2: return { kind: 1 };
				case 3: {
					const r = e.codePointAt(0), s = n.ambiguousCharacters.getPrimaryConfusable(r), a = $t.getLocales().filter((l) => !$t.getInstance(new Set([...t.allowedLocales, l])).isAmbiguous(r));
					return {
						kind: 0,
						confusableWith: String.fromCodePoint(s),
						notAmbiguousInLocales: a
					};
				}
				case 1: return { kind: 2 };
			}
		}
	};
	function la(e, t) {
		return `[${Bs(e.map((n) => String.fromCodePoint(n)).join(""))}]`;
	}
	var wr = class {
		constructor(e) {
			this.options = e, this.allowedCodePoints = new Set(e.allowedCodePoints), this.ambiguousCharacters = $t.getInstance(new Set(e.allowedLocales));
		}
		getCandidateCodePoints() {
			if (this.options.nonBasicASCII) return "allNonBasicAscii";
			const e = /* @__PURE__ */ new Set();
			if (this.options.invisibleCharacters) for (const t of zt.codePoints) yr(String.fromCodePoint(t)) || e.add(t);
			if (this.options.ambiguousCharacters) for (const t of this.ambiguousCharacters.getConfusableCodePoints()) e.add(t);
			for (const t of this.allowedCodePoints) e.delete(t);
			return e;
		}
		shouldHighlightNonBasicASCII(e, t) {
			const n = e.codePointAt(0);
			if (this.allowedCodePoints.has(n)) return 0;
			if (this.options.nonBasicASCII) return 1;
			let r = !1, s = !1;
			if (t) for (const a of t) {
				const l = a.codePointAt(0), o = js(a);
				r = r || o, !o && !this.ambiguousCharacters.isAmbiguous(l) && !zt.isInvisibleCharacter(l) && (s = !0);
			}
			return !r && s ? 0 : this.options.invisibleCharacters && !yr(e) && zt.isInvisibleCharacter(n) ? 2 : this.options.ambiguousCharacters && this.ambiguousCharacters.isAmbiguous(n) ? 3 : 0;
		}
	};
	function yr(e) {
		return e === " " || e === `
` || e === "	";
	}
	var bt = class {
		constructor(e, t, n) {
			this.changes = e, this.moves = t, this.hitTimeout = n;
		}
	}, oa = class {
		constructor(e, t) {
			this.lineRangeMapping = e, this.changes = t;
		}
	};
	function ua(e, t, n = (r, s) => r === s) {
		if (e === t) return !0;
		if (!e || !t || e.length !== t.length) return !1;
		for (let r = 0, s = e.length; r < s; r++) if (!n(e[r], t[r])) return !1;
		return !0;
	}
	function* ca(e, t) {
		let n, r;
		for (const s of e) r !== void 0 && t(r, s) ? n.push(s) : (n && (yield n), n = [s]), r = s;
		n && (yield n);
	}
	function ha(e, t) {
		for (let n = 0; n <= e.length; n++) t(n === 0 ? void 0 : e[n - 1], n === e.length ? void 0 : e[n]);
	}
	function ma(e, t) {
		for (let n = 0; n < e.length; n++) t(n === 0 ? void 0 : e[n - 1], e[n], n + 1 === e.length ? void 0 : e[n + 1]);
	}
	function fa(e, t) {
		for (const n of t) e.push(n);
	}
	var o1;
	(function(e) {
		function t(a) {
			return a < 0;
		}
		e.isLessThan = t;
		function n(a) {
			return a <= 0;
		}
		e.isLessThanOrEqual = n;
		function r(a) {
			return a > 0;
		}
		e.isGreaterThan = r;
		function s(a) {
			return a === 0;
		}
		e.isNeitherLessOrGreaterThan = s, e.greaterThan = 1, e.lessThan = -1, e.neitherLessOrGreaterThan = 0;
	})(o1 || (o1 = {}));
	function je(e, t) {
		return (n, r) => t(e(n), e(r));
	}
	const Xe = (e, t) => e - t;
	function ga(e) {
		return (t, n) => -e(t, n);
	}
	(class Mt {
		static #e = this.empty = new Mt((t) => {});
		constructor(t) {
			this.iterate = t;
		}
		toArray() {
			const t = [];
			return this.iterate((n) => (t.push(n), !0)), t;
		}
		filter(t) {
			return new Mt((n) => this.iterate((r) => t(r) ? n(r) : !0));
		}
		map(t) {
			return new Mt((n) => this.iterate((r) => n(t(r))));
		}
		findLast(t) {
			let n;
			return this.iterate((r) => (t(r) && (n = r), !0)), n;
		}
		findLastMaxBy(t) {
			let n, r = !0;
			return this.iterate((s) => ((r || o1.isGreaterThan(t(s, n))) && (r = !1, n = s), !0)), n;
		}
	});
	var $ = class se {
		static fromTo(t, n) {
			return new se(t, n);
		}
		static addRange(t, n) {
			let r = 0;
			for (; r < n.length && n[r].endExclusive < t.start;) r++;
			let s = r;
			for (; s < n.length && n[s].start <= t.endExclusive;) s++;
			if (r === s) n.splice(r, 0, t);
			else {
				const a = Math.min(t.start, n[r].start), l = Math.max(t.endExclusive, n[s - 1].endExclusive);
				n.splice(r, s - r, new se(a, l));
			}
		}
		static tryCreate(t, n) {
			if (!(t > n)) return new se(t, n);
		}
		static ofLength(t) {
			return new se(0, t);
		}
		static ofStartAndLength(t, n) {
			return new se(t, t + n);
		}
		static emptyAt(t) {
			return new se(t, t);
		}
		constructor(t, n) {
			if (this.start = t, this.endExclusive = n, t > n) throw new Z(`Invalid range: ${this.toString()}`);
		}
		get isEmpty() {
			return this.start === this.endExclusive;
		}
		delta(t) {
			return new se(this.start + t, this.endExclusive + t);
		}
		deltaStart(t) {
			return new se(this.start + t, this.endExclusive);
		}
		deltaEnd(t) {
			return new se(this.start, this.endExclusive + t);
		}
		get length() {
			return this.endExclusive - this.start;
		}
		toString() {
			return `[${this.start}, ${this.endExclusive})`;
		}
		equals(t) {
			return this.start === t.start && this.endExclusive === t.endExclusive;
		}
		contains(t) {
			return this.start <= t && t < this.endExclusive;
		}
		join(t) {
			return new se(Math.min(this.start, t.start), Math.max(this.endExclusive, t.endExclusive));
		}
		intersect(t) {
			const n = Math.max(this.start, t.start), r = Math.min(this.endExclusive, t.endExclusive);
			if (n <= r) return new se(n, r);
		}
		intersectionLength(t) {
			const n = Math.max(this.start, t.start), r = Math.min(this.endExclusive, t.endExclusive);
			return Math.max(0, r - n);
		}
		intersects(t) {
			return Math.max(this.start, t.start) < Math.min(this.endExclusive, t.endExclusive);
		}
		intersectsOrTouches(t) {
			return Math.max(this.start, t.start) <= Math.min(this.endExclusive, t.endExclusive);
		}
		isBefore(t) {
			return this.endExclusive <= t.start;
		}
		isAfter(t) {
			return this.start >= t.endExclusive;
		}
		slice(t) {
			return t.slice(this.start, this.endExclusive);
		}
		substring(t) {
			return t.substring(this.start, this.endExclusive);
		}
		clip(t) {
			if (this.isEmpty) throw new Z(`Invalid clipping range: ${this.toString()}`);
			return Math.max(this.start, Math.min(this.endExclusive - 1, t));
		}
		clipCyclic(t) {
			if (this.isEmpty) throw new Z(`Invalid clipping range: ${this.toString()}`);
			return t < this.start ? this.endExclusive - (this.start - t) % this.length : t >= this.endExclusive ? this.start + (t - this.start) % this.length : t;
		}
		forEach(t) {
			for (let n = this.start; n < this.endExclusive; n++) t(n);
		}
		joinRightTouching(t) {
			if (this.endExclusive !== t.start) throw new Z(`Invalid join: ${this.toString()} and ${t.toString()}`);
			return new se(this.start, t.endExclusive);
		}
	};
	function Te(e, t) {
		const n = Fe(e, t);
		return n === -1 ? void 0 : e[n];
	}
	function Fe(e, t, n = 0, r = e.length) {
		let s = n, a = r;
		for (; s < a;) {
			const l = Math.floor((s + a) / 2);
			t(e[l]) ? s = l + 1 : a = l;
		}
		return s - 1;
	}
	function da(e, t) {
		const n = u1(e, t);
		return n === e.length ? void 0 : e[n];
	}
	function u1(e, t, n = 0, r = e.length) {
		let s = n, a = r;
		for (; s < a;) {
			const l = Math.floor((s + a) / 2);
			t(e[l]) ? a = l : s = l + 1;
		}
		return s;
	}
	var _r = class es {
		static #e = this.assertInvariants = !1;
		constructor(t) {
			this._array = t, this._findLastMonotonousLastIdx = 0;
		}
		findLastMonotonous(t) {
			if (es.assertInvariants) {
				if (this._prevFindLastPredicate) {
					for (const r of this._array) if (this._prevFindLastPredicate(r) && !t(r)) throw new Error("MonotonousArray: current predicate must be weaker than (or equal to) the previous predicate.");
				}
				this._prevFindLastPredicate = t;
			}
			const n = Fe(this._array, t, this._findLastMonotonousLastIdx);
			return this._findLastMonotonousLastIdx = n + 1, n === -1 ? void 0 : this._array[n];
		}
	}, q = class oe {
		static ofLength(t, n) {
			return new oe(t, t + n);
		}
		static fromRange(t) {
			return new oe(t.startLineNumber, t.endLineNumber);
		}
		static fromRangeInclusive(t) {
			return new oe(t.startLineNumber, t.endLineNumber + 1);
		}
		static #e = this.compareByStart = je((t) => t.startLineNumber, Xe);
		static joinMany(t) {
			if (t.length === 0) return [];
			let n = new wt(t[0].slice());
			for (let r = 1; r < t.length; r++) n = n.getUnion(new wt(t[r].slice()));
			return n.ranges;
		}
		static join(t) {
			if (t.length === 0) throw new Z("lineRanges cannot be empty");
			let n = t[0].startLineNumber, r = t[0].endLineNumberExclusive;
			for (let s = 1; s < t.length; s++) n = Math.min(n, t[s].startLineNumber), r = Math.max(r, t[s].endLineNumberExclusive);
			return new oe(n, r);
		}
		static deserialize(t) {
			return new oe(t[0], t[1]);
		}
		constructor(t, n) {
			if (t > n) throw new Z(`startLineNumber ${t} cannot be after endLineNumberExclusive ${n}`);
			this.startLineNumber = t, this.endLineNumberExclusive = n;
		}
		contains(t) {
			return this.startLineNumber <= t && t < this.endLineNumberExclusive;
		}
		get isEmpty() {
			return this.startLineNumber === this.endLineNumberExclusive;
		}
		delta(t) {
			return new oe(this.startLineNumber + t, this.endLineNumberExclusive + t);
		}
		deltaLength(t) {
			return new oe(this.startLineNumber, this.endLineNumberExclusive + t);
		}
		get length() {
			return this.endLineNumberExclusive - this.startLineNumber;
		}
		join(t) {
			return new oe(Math.min(this.startLineNumber, t.startLineNumber), Math.max(this.endLineNumberExclusive, t.endLineNumberExclusive));
		}
		toString() {
			return `[${this.startLineNumber},${this.endLineNumberExclusive})`;
		}
		intersect(t) {
			const n = Math.max(this.startLineNumber, t.startLineNumber), r = Math.min(this.endLineNumberExclusive, t.endLineNumberExclusive);
			if (n <= r) return new oe(n, r);
		}
		intersectsStrict(t) {
			return this.startLineNumber < t.endLineNumberExclusive && t.startLineNumber < this.endLineNumberExclusive;
		}
		intersectsOrTouches(t) {
			return this.startLineNumber <= t.endLineNumberExclusive && t.startLineNumber <= this.endLineNumberExclusive;
		}
		equals(t) {
			return this.startLineNumber === t.startLineNumber && this.endLineNumberExclusive === t.endLineNumberExclusive;
		}
		toInclusiveRange() {
			return this.isEmpty ? null : new I(this.startLineNumber, 1, this.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER);
		}
		toExclusiveRange() {
			return new I(this.startLineNumber, 1, this.endLineNumberExclusive, 1);
		}
		mapToLineArray(t) {
			const n = [];
			for (let r = this.startLineNumber; r < this.endLineNumberExclusive; r++) n.push(t(r));
			return n;
		}
		forEach(t) {
			for (let n = this.startLineNumber; n < this.endLineNumberExclusive; n++) t(n);
		}
		serialize() {
			return [this.startLineNumber, this.endLineNumberExclusive];
		}
		toOffsetRange() {
			return new $(this.startLineNumber - 1, this.endLineNumberExclusive - 1);
		}
		addMargin(t, n) {
			return new oe(this.startLineNumber - t, this.endLineNumberExclusive + n);
		}
	}, wt = class He {
		constructor(t = []) {
			this._normalizedRanges = t;
		}
		get ranges() {
			return this._normalizedRanges;
		}
		addRange(t) {
			if (t.length === 0) return;
			const n = u1(this._normalizedRanges, (s) => s.endLineNumberExclusive >= t.startLineNumber), r = Fe(this._normalizedRanges, (s) => s.startLineNumber <= t.endLineNumberExclusive) + 1;
			if (n === r) this._normalizedRanges.splice(n, 0, t);
			else if (n === r - 1) {
				const s = this._normalizedRanges[n];
				this._normalizedRanges[n] = s.join(t);
			} else {
				const s = this._normalizedRanges[n].join(this._normalizedRanges[r - 1]).join(t);
				this._normalizedRanges.splice(n, r - n, s);
			}
		}
		contains(t) {
			const n = Te(this._normalizedRanges, (r) => r.startLineNumber <= t);
			return !!n && n.endLineNumberExclusive > t;
		}
		intersects(t) {
			const n = Te(this._normalizedRanges, (r) => r.startLineNumber < t.endLineNumberExclusive);
			return !!n && n.endLineNumberExclusive > t.startLineNumber;
		}
		getUnion(t) {
			if (this._normalizedRanges.length === 0) return t;
			if (t._normalizedRanges.length === 0) return this;
			const n = [];
			let r = 0, s = 0, a = null;
			for (; r < this._normalizedRanges.length || s < t._normalizedRanges.length;) {
				let l = null;
				if (r < this._normalizedRanges.length && s < t._normalizedRanges.length) {
					const o = this._normalizedRanges[r], u = t._normalizedRanges[s];
					o.startLineNumber < u.startLineNumber ? (l = o, r++) : (l = u, s++);
				} else r < this._normalizedRanges.length ? (l = this._normalizedRanges[r], r++) : (l = t._normalizedRanges[s], s++);
				a === null ? a = l : a.endLineNumberExclusive >= l.startLineNumber ? a = new q(a.startLineNumber, Math.max(a.endLineNumberExclusive, l.endLineNumberExclusive)) : (n.push(a), a = l);
			}
			return a !== null && n.push(a), new He(n);
		}
		subtractFrom(t) {
			const n = u1(this._normalizedRanges, (l) => l.endLineNumberExclusive >= t.startLineNumber), r = Fe(this._normalizedRanges, (l) => l.startLineNumber <= t.endLineNumberExclusive) + 1;
			if (n === r) return new He([t]);
			const s = [];
			let a = t.startLineNumber;
			for (let l = n; l < r; l++) {
				const o = this._normalizedRanges[l];
				o.startLineNumber > a && s.push(new q(a, o.startLineNumber)), a = o.endLineNumberExclusive;
			}
			return a < t.endLineNumberExclusive && s.push(new q(a, t.endLineNumberExclusive)), new He(s);
		}
		toString() {
			return this._normalizedRanges.map((t) => t.toString()).join(", ");
		}
		getIntersection(t) {
			const n = [];
			let r = 0, s = 0;
			for (; r < this._normalizedRanges.length && s < t._normalizedRanges.length;) {
				const a = this._normalizedRanges[r], l = t._normalizedRanges[s], o = a.intersect(l);
				o && !o.isEmpty && n.push(o), a.endLineNumberExclusive < l.endLineNumberExclusive ? r++ : s++;
			}
			return new He(n);
		}
		getWithDelta(t) {
			return new He(this._normalizedRanges.map((n) => n.delta(t)));
		}
	}, c1 = class pe {
		static #e = this.zero = new pe(0, 0);
		static betweenPositions(t, n) {
			return t.lineNumber === n.lineNumber ? new pe(0, n.column - t.column) : new pe(n.lineNumber - t.lineNumber, n.column - 1);
		}
		static fromPosition(t) {
			return new pe(t.lineNumber - 1, t.column - 1);
		}
		static ofRange(t) {
			return pe.betweenPositions(t.getStartPosition(), t.getEndPosition());
		}
		static ofText(t) {
			let n = 0, r = 0;
			for (const s of t) s === `
` ? (n++, r = 0) : r++;
			return new pe(n, r);
		}
		constructor(t, n) {
			this.lineCount = t, this.columnCount = n;
		}
		isGreaterThanOrEqualTo(t) {
			return this.lineCount !== t.lineCount ? this.lineCount > t.lineCount : this.columnCount >= t.columnCount;
		}
		add(t) {
			return t.lineCount === 0 ? new pe(this.lineCount, this.columnCount + t.columnCount) : new pe(this.lineCount + t.lineCount, t.columnCount);
		}
		createRange(t) {
			return this.lineCount === 0 ? new I(t.lineNumber, t.column, t.lineNumber, t.column + this.columnCount) : new I(t.lineNumber, t.column, t.lineNumber + this.lineCount, this.columnCount + 1);
		}
		toRange() {
			return new I(1, 1, this.lineCount + 1, this.columnCount + 1);
		}
		toLineRange() {
			return q.ofLength(1, this.lineCount + 1);
		}
		addToPosition(t) {
			return this.lineCount === 0 ? new W(t.lineNumber, t.column + this.columnCount) : new W(t.lineNumber + this.lineCount, this.columnCount + 1);
		}
		toString() {
			return `${this.lineCount},${this.columnCount}`;
		}
	}, pa = class {
		getOffsetRange(e) {
			return new $(this.getOffset(e.getStartPosition()), this.getOffset(e.getEndPosition()));
		}
		getRange(e) {
			return I.fromPositions(this.getPosition(e.start), this.getPosition(e.endExclusive));
		}
		getStringReplacement(e) {
			return new yt.deps.StringReplacement(this.getOffsetRange(e.range), e.text);
		}
		getTextReplacement(e) {
			return new yt.deps.TextReplacement(this.getRange(e.replaceRange), e.newText);
		}
		getTextEdit(e) {
			const t = e.replacements.map((n) => this.getTextReplacement(n));
			return new yt.deps.TextEdit(t);
		}
	}, yt = class {
		static #e = this._deps = void 0;
		static get deps() {
			if (!this._deps) throw new Error("Dependencies not set. Call _setDependencies first.");
			return this._deps;
		}
	}, ba = class extends pa {
		constructor(e) {
			super(), this.text = e, this.lineStartOffsetByLineIdx = [], this.lineEndOffsetByLineIdx = [], this.lineStartOffsetByLineIdx.push(0);
			for (let t = 0; t < e.length; t++) e.charAt(t) === `
` && (this.lineStartOffsetByLineIdx.push(t + 1), t > 0 && e.charAt(t - 1) === "\r" ? this.lineEndOffsetByLineIdx.push(t - 1) : this.lineEndOffsetByLineIdx.push(t));
			this.lineEndOffsetByLineIdx.push(e.length);
		}
		getOffset(e) {
			const t = this._validatePosition(e);
			return this.lineStartOffsetByLineIdx[t.lineNumber - 1] + t.column - 1;
		}
		_validatePosition(e) {
			if (e.lineNumber < 1) return new W(1, 1);
			const t = this.textLength.lineCount + 1;
			if (e.lineNumber > t) return new W(t, this.getLineLength(t) + 1);
			if (e.column < 1) return new W(e.lineNumber, 1);
			const n = this.getLineLength(e.lineNumber);
			return e.column - 1 > n ? new W(e.lineNumber, n + 1) : e;
		}
		getPosition(e) {
			const t = Fe(this.lineStartOffsetByLineIdx, (n) => n <= e);
			return new W(t + 1, e - this.lineStartOffsetByLineIdx[t] + 1);
		}
		get textLength() {
			const e = this.lineStartOffsetByLineIdx.length - 1;
			return new yt.deps.TextLength(e, this.text.length - this.lineStartOffsetByLineIdx[e]);
		}
		getLineLength(e) {
			return this.lineEndOffsetByLineIdx[e - 1] - this.lineStartOffsetByLineIdx[e - 1];
		}
	}, wa = class {
		constructor() {
			this._transformer = void 0;
		}
		get endPositionExclusive() {
			return this.length.addToPosition(new W(1, 1));
		}
		get lineRange() {
			return this.length.toLineRange();
		}
		getValue() {
			return this.getValueOfRange(this.length.toRange());
		}
		getValueOfOffsetRange(e) {
			return this.getValueOfRange(this.getTransformer().getRange(e));
		}
		getLineLength(e) {
			return this.getValueOfRange(new I(e, 1, e, Number.MAX_SAFE_INTEGER)).length;
		}
		getTransformer() {
			return this._transformer || (this._transformer = new ba(this.getValue())), this._transformer;
		}
		getLineAt(e) {
			return this.getValueOfRange(new I(e, 1, e, Number.MAX_SAFE_INTEGER));
		}
	}, ya = class extends wa {
		constructor(e, t) {
			cs(t >= 1), super(), this._getLineContent = e, this._lineCount = t;
		}
		getValueOfRange(e) {
			if (e.startLineNumber === e.endLineNumber) return this._getLineContent(e.startLineNumber).substring(e.startColumn - 1, e.endColumn - 1);
			let t = this._getLineContent(e.startLineNumber).substring(e.startColumn - 1);
			for (let n = e.startLineNumber + 1; n < e.endLineNumber; n++) t += `
` + this._getLineContent(n);
			return t += `
` + this._getLineContent(e.endLineNumber).substring(0, e.endColumn - 1), t;
		}
		getLineLength(e) {
			return this._getLineContent(e).length;
		}
		get length() {
			const e = this._getLineContent(this._lineCount);
			return new c1(this._lineCount - 1, e.length);
		}
	}, _t = class extends ya {
		constructor(e) {
			super((t) => e[t - 1], e.length);
		}
	}, _a = class xe {
		static joinReplacements(t, n) {
			if (t.length === 0) throw new Z();
			if (t.length === 1) return t[0];
			const r = t[0].range.getStartPosition(), s = t[t.length - 1].range.getEndPosition();
			let a = "";
			for (let l = 0; l < t.length; l++) {
				const o = t[l];
				if (a += o.text, l < t.length - 1) {
					const u = t[l + 1], c = I.fromPositions(o.range.getEndPosition(), u.range.getStartPosition()), m = n.getValueOfRange(c);
					a += m;
				}
			}
			return new xe(I.fromPositions(r, s), a);
		}
		static fromStringReplacement(t, n) {
			return new xe(n.getTransformer().getRange(t.replaceRange), t.newText);
		}
		static delete(t) {
			return new xe(t, "");
		}
		constructor(t, n) {
			this.range = t, this.text = n;
		}
		get isEmpty() {
			return this.range.isEmpty() && this.text.length === 0;
		}
		static equals(t, n) {
			return t.range.equalsRange(n.range) && t.text === n.text;
		}
		equals(t) {
			return xe.equals(this, t);
		}
		removeCommonPrefixAndSuffix(t) {
			return this.removeCommonPrefix(t).removeCommonSuffix(t);
		}
		removeCommonPrefix(t) {
			const n = t.getValueOfRange(this.range).replaceAll(`\r
`, `
`), r = this.text.replaceAll(`\r
`, `
`), s = $s(n, r), a = c1.ofText(n.substring(0, s)).addToPosition(this.range.getStartPosition()), l = r.substring(s);
			return new xe(I.fromPositions(a, this.range.getEndPosition()), l);
		}
		removeCommonSuffix(t) {
			const n = t.getValueOfRange(this.range).replaceAll(`\r
`, `
`), r = this.text.replaceAll(`\r
`, `
`), s = zs(n, r), a = c1.ofText(n.substring(0, n.length - s)).addToPosition(this.range.getStartPosition()), l = r.substring(0, r.length - s);
			return new xe(I.fromPositions(this.range.getStartPosition(), a), l);
		}
		toString() {
			const t = this.range.getStartPosition(), n = this.range.getEndPosition();
			return `(${t.lineNumber},${t.column} -> ${n.lineNumber},${n.column}): "${this.text}"`;
		}
	}, Ie = class We {
		static inverse(t, n, r) {
			const s = [];
			let a = 1, l = 1;
			for (const u of t) {
				const c = new We(new q(a, u.original.startLineNumber), new q(l, u.modified.startLineNumber));
				c.modified.isEmpty || s.push(c), a = u.original.endLineNumberExclusive, l = u.modified.endLineNumberExclusive;
			}
			const o = new We(new q(a, n + 1), new q(l, r + 1));
			return o.modified.isEmpty || s.push(o), s;
		}
		static clip(t, n, r) {
			const s = [];
			for (const a of t) {
				const l = a.original.intersect(n), o = a.modified.intersect(r);
				l && !l.isEmpty && o && !o.isEmpty && s.push(new We(l, o));
			}
			return s;
		}
		constructor(t, n) {
			this.original = t, this.modified = n;
		}
		toString() {
			return `{${this.original.toString()}->${this.modified.toString()}}`;
		}
		flip() {
			return new We(this.modified, this.original);
		}
		join(t) {
			return new We(this.original.join(t.original), this.modified.join(t.modified));
		}
		toRangeMapping() {
			const t = this.original.toInclusiveRange(), n = this.modified.toInclusiveRange();
			if (t && n) return new de(t, n);
			if (this.original.startLineNumber === 1 || this.modified.startLineNumber === 1) {
				if (!(this.modified.startLineNumber === 1 && this.original.startLineNumber === 1)) throw new Z("not a valid diff");
				return new de(new I(this.original.startLineNumber, 1, this.original.endLineNumberExclusive, 1), new I(this.modified.startLineNumber, 1, this.modified.endLineNumberExclusive, 1));
			} else return new de(new I(this.original.startLineNumber - 1, Number.MAX_SAFE_INTEGER, this.original.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), new I(this.modified.startLineNumber - 1, Number.MAX_SAFE_INTEGER, this.modified.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER));
		}
		toRangeMapping2(t, n) {
			if (vr(this.original.endLineNumberExclusive, t) && vr(this.modified.endLineNumberExclusive, n)) return new de(new I(this.original.startLineNumber, 1, this.original.endLineNumberExclusive, 1), new I(this.modified.startLineNumber, 1, this.modified.endLineNumberExclusive, 1));
			if (!this.original.isEmpty && !this.modified.isEmpty) return new de(I.fromPositions(new W(this.original.startLineNumber, 1), Ve(new W(this.original.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), t)), I.fromPositions(new W(this.modified.startLineNumber, 1), Ve(new W(this.modified.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), n)));
			if (this.original.startLineNumber > 1 && this.modified.startLineNumber > 1) return new de(I.fromPositions(Ve(new W(this.original.startLineNumber - 1, Number.MAX_SAFE_INTEGER), t), Ve(new W(this.original.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), t)), I.fromPositions(Ve(new W(this.modified.startLineNumber - 1, Number.MAX_SAFE_INTEGER), n), Ve(new W(this.modified.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), n)));
			throw new Z();
		}
	};
	function Ve(e, t) {
		if (e.lineNumber < 1) return new W(1, 1);
		if (e.lineNumber > t.length) return new W(t.length, t[t.length - 1].length + 1);
		const n = t[e.lineNumber - 1];
		return e.column > n.length + 1 ? new W(e.lineNumber, n.length + 1) : e;
	}
	function vr(e, t) {
		return e >= 1 && e <= t.length;
	}
	var Qe = class Et extends Ie {
		static fromRangeMappings(t) {
			return new Et(q.join(t.map((n) => q.fromRangeInclusive(n.originalRange))), q.join(t.map((n) => q.fromRangeInclusive(n.modifiedRange))), t);
		}
		constructor(t, n, r) {
			super(t, n), this.innerChanges = r;
		}
		flip() {
			return new Et(this.modified, this.original, this.innerChanges?.map((t) => t.flip()));
		}
		withInnerChangesFromLineRanges() {
			return new Et(this.original, this.modified, [this.toRangeMapping()]);
		}
	}, de = class L1 {
		static fromEdit(t) {
			const n = t.getNewRanges();
			return t.replacements.map((r, s) => new L1(r.range, n[s]));
		}
		static assertSorted(t) {
			for (let n = 1; n < t.length; n++) {
				const r = t[n - 1], s = t[n];
				if (!(r.originalRange.getEndPosition().isBeforeOrEqual(s.originalRange.getStartPosition()) && r.modifiedRange.getEndPosition().isBeforeOrEqual(s.modifiedRange.getStartPosition()))) throw new Z("Range mappings must be sorted");
			}
		}
		constructor(t, n) {
			this.originalRange = t, this.modifiedRange = n;
		}
		toString() {
			return `{${this.originalRange.toString()}->${this.modifiedRange.toString()}}`;
		}
		flip() {
			return new L1(this.modifiedRange, this.originalRange);
		}
		toTextEdit(t) {
			const n = t.getValueOfRange(this.modifiedRange);
			return new _a(this.originalRange, n);
		}
	};
	function Lr(e, t, n, r = !1) {
		const s = [];
		for (const a of ca(e.map((l) => va(l, t, n)), (l, o) => l.original.intersectsOrTouches(o.original) || l.modified.intersectsOrTouches(o.modified))) {
			const l = a[0], o = a[a.length - 1];
			s.push(new Qe(l.original.join(o.original), l.modified.join(o.modified), a.map((u) => u.innerChanges[0])));
		}
		return st(() => !r && s.length > 0 && (s[0].modified.startLineNumber !== s[0].original.startLineNumber || n.length.lineCount - s[s.length - 1].modified.endLineNumberExclusive !== t.length.lineCount - s[s.length - 1].original.endLineNumberExclusive) ? !1 : C1(s, (a, l) => l.original.startLineNumber - a.original.endLineNumberExclusive === l.modified.startLineNumber - a.modified.endLineNumberExclusive && a.original.endLineNumberExclusive < l.original.startLineNumber && a.modified.endLineNumberExclusive < l.modified.startLineNumber)), s;
	}
	function va(e, t, n) {
		let r = 0, s = 0;
		return e.modifiedRange.endColumn === 1 && e.originalRange.endColumn === 1 && e.originalRange.startLineNumber + r <= e.originalRange.endLineNumber && e.modifiedRange.startLineNumber + r <= e.modifiedRange.endLineNumber && (s = -1), e.modifiedRange.startColumn - 1 >= n.getLineLength(e.modifiedRange.startLineNumber) && e.originalRange.startColumn - 1 >= t.getLineLength(e.originalRange.startLineNumber) && e.originalRange.startLineNumber <= e.originalRange.endLineNumber + s && e.modifiedRange.startLineNumber <= e.modifiedRange.endLineNumber + s && (r = 1), new Qe(new q(e.originalRange.startLineNumber + r, e.originalRange.endLineNumber + 1 + s), new q(e.modifiedRange.startLineNumber + r, e.modifiedRange.endLineNumber + 1 + s), [e]);
	}
	const La = 3;
	var Na = class {
		computeDiff(e, t, n) {
			const r = new Aa(e, t, {
				maxComputationTime: n.maxComputationTimeMs,
				shouldIgnoreTrimWhitespace: n.ignoreTrimWhitespace,
				shouldComputeCharChanges: !0,
				shouldMakePrettyDiff: !0,
				shouldPostProcessCharChanges: !0
			}).computeDiff(), s = [];
			let a = null;
			for (const l of r.changes) {
				let o;
				l.originalEndLineNumber === 0 ? o = new q(l.originalStartLineNumber + 1, l.originalStartLineNumber + 1) : o = new q(l.originalStartLineNumber, l.originalEndLineNumber + 1);
				let u;
				l.modifiedEndLineNumber === 0 ? u = new q(l.modifiedStartLineNumber + 1, l.modifiedStartLineNumber + 1) : u = new q(l.modifiedStartLineNumber, l.modifiedEndLineNumber + 1);
				let c = new Qe(o, u, l.charChanges?.map((m) => new de(new I(m.originalStartLineNumber, m.originalStartColumn, m.originalEndLineNumber, m.originalEndColumn), new I(m.modifiedStartLineNumber, m.modifiedStartColumn, m.modifiedEndLineNumber, m.modifiedEndColumn))));
				a && (a.modified.endLineNumberExclusive === c.modified.startLineNumber || a.original.endLineNumberExclusive === c.original.startLineNumber) && (c = new Qe(a.original.join(c.original), a.modified.join(c.modified), a.innerChanges && c.innerChanges ? a.innerChanges.concat(c.innerChanges) : void 0), s.pop()), s.push(c), a = c;
			}
			return st(() => C1(s, (l, o) => o.original.startLineNumber - l.original.endLineNumberExclusive === o.modified.startLineNumber - l.modified.endLineNumberExclusive && l.original.endLineNumberExclusive < o.original.startLineNumber && l.modified.endLineNumberExclusive < o.modified.startLineNumber)), new bt(s, [], r.quitEarly);
		}
	};
	function Nr(e, t, n, r) {
		return new z1(e, t, n).ComputeDiff(r);
	}
	var Sr = class {
		constructor(e) {
			const t = [], n = [];
			for (let r = 0, s = e.length; r < s; r++) t[r] = m1(e[r], 1), n[r] = f1(e[r], 1);
			this.lines = e, this._startColumns = t, this._endColumns = n;
		}
		getElements() {
			const e = [];
			for (let t = 0, n = this.lines.length; t < n; t++) e[t] = this.lines[t].substring(this._startColumns[t] - 1, this._endColumns[t] - 1);
			return e;
		}
		getStrictElement(e) {
			return this.lines[e];
		}
		getStartLineNumber(e) {
			return e + 1;
		}
		getEndLineNumber(e) {
			return e + 1;
		}
		createCharSequence(e, t, n) {
			const r = [], s = [], a = [];
			let l = 0;
			for (let o = t; o <= n; o++) {
				const u = this.lines[o], c = e ? this._startColumns[o] : 1, m = e ? this._endColumns[o] : u.length + 1;
				for (let h = c; h < m; h++) r[l] = u.charCodeAt(h - 1), s[l] = o + 1, a[l] = h, l++;
				!e && o < n && (r[l] = 10, s[l] = o + 1, a[l] = u.length + 1, l++);
			}
			return new Sa(r, s, a);
		}
	}, Sa = class {
		constructor(e, t, n) {
			this._charCodes = e, this._lineNumbers = t, this._columns = n;
		}
		toString() {
			return "[" + this._charCodes.map((e, t) => (e === 10 ? "\\n" : String.fromCharCode(e)) + `-(${this._lineNumbers[t]},${this._columns[t]})`).join(", ") + "]";
		}
		_assertIndex(e, t) {
			if (e < 0 || e >= t.length) throw new Error("Illegal index");
		}
		getElements() {
			return this._charCodes;
		}
		getStartLineNumber(e) {
			return e > 0 && e === this._lineNumbers.length ? this.getEndLineNumber(e - 1) : (this._assertIndex(e, this._lineNumbers), this._lineNumbers[e]);
		}
		getEndLineNumber(e) {
			return e === -1 ? this.getStartLineNumber(e + 1) : (this._assertIndex(e, this._lineNumbers), this._charCodes[e] === 10 ? this._lineNumbers[e] + 1 : this._lineNumbers[e]);
		}
		getStartColumn(e) {
			return e > 0 && e === this._columns.length ? this.getEndColumn(e - 1) : (this._assertIndex(e, this._columns), this._columns[e]);
		}
		getEndColumn(e) {
			return e === -1 ? this.getStartColumn(e + 1) : (this._assertIndex(e, this._columns), this._charCodes[e] === 10 ? 1 : this._columns[e] + 1);
		}
	}, vt = class ts {
		constructor(t, n, r, s, a, l, o, u) {
			this.originalStartLineNumber = t, this.originalStartColumn = n, this.originalEndLineNumber = r, this.originalEndColumn = s, this.modifiedStartLineNumber = a, this.modifiedStartColumn = l, this.modifiedEndLineNumber = o, this.modifiedEndColumn = u;
		}
		static createFromDiffChange(t, n, r) {
			return new ts(n.getStartLineNumber(t.originalStart), n.getStartColumn(t.originalStart), n.getEndLineNumber(t.originalStart + t.originalLength - 1), n.getEndColumn(t.originalStart + t.originalLength - 1), r.getStartLineNumber(t.modifiedStart), r.getStartColumn(t.modifiedStart), r.getEndLineNumber(t.modifiedStart + t.modifiedLength - 1), r.getEndColumn(t.modifiedStart + t.modifiedLength - 1));
		}
	};
	function Ra(e) {
		if (e.length <= 1) return e;
		const t = [e[0]];
		let n = t[0];
		for (let r = 1, s = e.length; r < s; r++) {
			const a = e[r], l = a.originalStart - (n.originalStart + n.originalLength), o = a.modifiedStart - (n.modifiedStart + n.modifiedLength);
			Math.min(l, o) < La ? (n.originalLength = a.originalStart + a.originalLength - n.originalStart, n.modifiedLength = a.modifiedStart + a.modifiedLength - n.modifiedStart) : (t.push(a), n = a);
		}
		return t;
	}
	var h1 = class ns {
		constructor(t, n, r, s, a) {
			this.originalStartLineNumber = t, this.originalEndLineNumber = n, this.modifiedStartLineNumber = r, this.modifiedEndLineNumber = s, this.charChanges = a;
		}
		static createFromDiffResult(t, n, r, s, a, l, o) {
			let u, c, m, h, d;
			if (n.originalLength === 0 ? (u = r.getStartLineNumber(n.originalStart) - 1, c = 0) : (u = r.getStartLineNumber(n.originalStart), c = r.getEndLineNumber(n.originalStart + n.originalLength - 1)), n.modifiedLength === 0 ? (m = s.getStartLineNumber(n.modifiedStart) - 1, h = 0) : (m = s.getStartLineNumber(n.modifiedStart), h = s.getEndLineNumber(n.modifiedStart + n.modifiedLength - 1)), l && n.originalLength > 0 && n.originalLength < 20 && n.modifiedLength > 0 && n.modifiedLength < 20 && a()) {
				const f = r.createCharSequence(t, n.originalStart, n.originalStart + n.originalLength - 1), b = s.createCharSequence(t, n.modifiedStart, n.modifiedStart + n.modifiedLength - 1);
				if (f.getElements().length > 0 && b.getElements().length > 0) {
					let p = Nr(f, b, a, !0).changes;
					o && (p = Ra(p)), d = [];
					for (let y = 0, v = p.length; y < v; y++) d.push(vt.createFromDiffChange(p[y], f, b));
				}
			}
			return new ns(u, c, m, h, d);
		}
	}, Aa = class {
		constructor(e, t, n) {
			this.shouldComputeCharChanges = n.shouldComputeCharChanges, this.shouldPostProcessCharChanges = n.shouldPostProcessCharChanges, this.shouldIgnoreTrimWhitespace = n.shouldIgnoreTrimWhitespace, this.shouldMakePrettyDiff = n.shouldMakePrettyDiff, this.originalLines = e, this.modifiedLines = t, this.original = new Sr(e), this.modified = new Sr(t), this.continueLineDiff = Rr(n.maxComputationTime), this.continueCharDiff = Rr(n.maxComputationTime === 0 ? 0 : Math.min(n.maxComputationTime, 5e3));
		}
		computeDiff() {
			if (this.original.lines.length === 1 && this.original.lines[0].length === 0) return this.modified.lines.length === 1 && this.modified.lines[0].length === 0 ? {
				quitEarly: !1,
				changes: []
			} : {
				quitEarly: !1,
				changes: [{
					originalStartLineNumber: 1,
					originalEndLineNumber: 1,
					modifiedStartLineNumber: 1,
					modifiedEndLineNumber: this.modified.lines.length,
					charChanges: void 0
				}]
			};
			if (this.modified.lines.length === 1 && this.modified.lines[0].length === 0) return {
				quitEarly: !1,
				changes: [{
					originalStartLineNumber: 1,
					originalEndLineNumber: this.original.lines.length,
					modifiedStartLineNumber: 1,
					modifiedEndLineNumber: 1,
					charChanges: void 0
				}]
			};
			const e = Nr(this.original, this.modified, this.continueLineDiff, this.shouldMakePrettyDiff), t = e.changes, n = e.quitEarly;
			if (this.shouldIgnoreTrimWhitespace) {
				const l = [];
				for (let o = 0, u = t.length; o < u; o++) l.push(h1.createFromDiffResult(this.shouldIgnoreTrimWhitespace, t[o], this.original, this.modified, this.continueCharDiff, this.shouldComputeCharChanges, this.shouldPostProcessCharChanges));
				return {
					quitEarly: n,
					changes: l
				};
			}
			const r = [];
			let s = 0, a = 0;
			for (let l = -1, o = t.length; l < o; l++) {
				const u = l + 1 < o ? t[l + 1] : null, c = u ? u.originalStart : this.originalLines.length, m = u ? u.modifiedStart : this.modifiedLines.length;
				for (; s < c && a < m;) {
					const h = this.originalLines[s], d = this.modifiedLines[a];
					if (h !== d) {
						{
							let f = m1(h, 1), b = m1(d, 1);
							for (; f > 1 && b > 1 && h.charCodeAt(f - 2) === d.charCodeAt(b - 2);) f--, b--;
							(f > 1 || b > 1) && this._pushTrimWhitespaceCharChange(r, s + 1, 1, f, a + 1, 1, b);
						}
						{
							let f = f1(h, 1), b = f1(d, 1);
							const p = h.length + 1, y = d.length + 1;
							for (; f < p && b < y && h.charCodeAt(f - 1) === h.charCodeAt(b - 1);) f++, b++;
							(f < p || b < y) && this._pushTrimWhitespaceCharChange(r, s + 1, f, p, a + 1, b, y);
						}
					}
					s++, a++;
				}
				u && (r.push(h1.createFromDiffResult(this.shouldIgnoreTrimWhitespace, u, this.original, this.modified, this.continueCharDiff, this.shouldComputeCharChanges, this.shouldPostProcessCharChanges)), s += u.originalLength, a += u.modifiedLength);
			}
			return {
				quitEarly: n,
				changes: r
			};
		}
		_pushTrimWhitespaceCharChange(e, t, n, r, s, a, l) {
			if (this._mergeTrimWhitespaceCharChange(e, t, n, r, s, a, l)) return;
			let o;
			this.shouldComputeCharChanges && (o = [new vt(t, n, t, r, s, a, s, l)]), e.push(new h1(t, t, s, s, o));
		}
		_mergeTrimWhitespaceCharChange(e, t, n, r, s, a, l) {
			const o = e.length;
			if (o === 0) return !1;
			const u = e[o - 1];
			return u.originalEndLineNumber === 0 || u.modifiedEndLineNumber === 0 ? !1 : u.originalEndLineNumber === t && u.modifiedEndLineNumber === s ? (this.shouldComputeCharChanges && u.charChanges && u.charChanges.push(new vt(t, n, t, r, s, a, s, l)), !0) : u.originalEndLineNumber + 1 === t && u.modifiedEndLineNumber + 1 === s ? (u.originalEndLineNumber = t, u.modifiedEndLineNumber = s, this.shouldComputeCharChanges && u.charChanges && u.charChanges.push(new vt(t, n, t, r, s, a, s, l)), !0) : !1;
		}
	};
	function m1(e, t) {
		const n = Hs(e);
		return n === -1 ? t : n + 1;
	}
	function f1(e, t) {
		const n = Ws(e);
		return n === -1 ? t : n + 2;
	}
	function Rr(e) {
		if (e === 0) return () => !0;
		const t = Date.now();
		return () => Date.now() - t < e;
	}
	var Be = class N1 {
		static trivial(t, n) {
			return new N1([new re($.ofLength(t.length), $.ofLength(n.length))], !1);
		}
		static trivialTimedOut(t, n) {
			return new N1([new re($.ofLength(t.length), $.ofLength(n.length))], !0);
		}
		constructor(t, n) {
			this.diffs = t, this.hitTimeout = n;
		}
	}, re = class be {
		static invert(t, n) {
			const r = [];
			return ha(t, (s, a) => {
				r.push(be.fromOffsetPairs(s ? s.getEndExclusives() : Se.zero, a ? a.getStarts() : new Se(n, (s ? s.seq2Range.endExclusive - s.seq1Range.endExclusive : 0) + n)));
			}), r;
		}
		static fromOffsetPairs(t, n) {
			return new be(new $(t.offset1, n.offset1), new $(t.offset2, n.offset2));
		}
		static assertSorted(t) {
			let n;
			for (const r of t) {
				if (n && !(n.seq1Range.endExclusive <= r.seq1Range.start && n.seq2Range.endExclusive <= r.seq2Range.start)) throw new Z("Sequence diffs must be sorted");
				n = r;
			}
		}
		constructor(t, n) {
			this.seq1Range = t, this.seq2Range = n;
		}
		swap() {
			return new be(this.seq2Range, this.seq1Range);
		}
		toString() {
			return `${this.seq1Range} <-> ${this.seq2Range}`;
		}
		join(t) {
			return new be(this.seq1Range.join(t.seq1Range), this.seq2Range.join(t.seq2Range));
		}
		delta(t) {
			return t === 0 ? this : new be(this.seq1Range.delta(t), this.seq2Range.delta(t));
		}
		deltaStart(t) {
			return t === 0 ? this : new be(this.seq1Range.deltaStart(t), this.seq2Range.deltaStart(t));
		}
		deltaEnd(t) {
			return t === 0 ? this : new be(this.seq1Range.deltaEnd(t), this.seq2Range.deltaEnd(t));
		}
		intersect(t) {
			const n = this.seq1Range.intersect(t.seq1Range), r = this.seq2Range.intersect(t.seq2Range);
			if (!(!n || !r)) return new be(n, r);
		}
		getStarts() {
			return new Se(this.seq1Range.start, this.seq2Range.start);
		}
		getEndExclusives() {
			return new Se(this.seq1Range.endExclusive, this.seq2Range.endExclusive);
		}
	}, Se = class Pt {
		static #e = this.zero = new Pt(0, 0);
		static #t = this.max = new Pt(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
		constructor(t, n) {
			this.offset1 = t, this.offset2 = n;
		}
		toString() {
			return `${this.offset1} <-> ${this.offset2}`;
		}
		delta(t) {
			return t === 0 ? this : new Pt(this.offset1 + t, this.offset2 + t);
		}
		equals(t) {
			return this.offset1 === t.offset1 && this.offset2 === t.offset2;
		}
	}, g1 = class rs {
		static #e = this.instance = new rs();
		isValid() {
			return !0;
		}
	}, Ca = class {
		constructor(e) {
			if (this.timeout = e, this.startTime = Date.now(), this.valid = !0, e <= 0) throw new Z("timeout must be positive");
		}
		isValid() {
			return !(Date.now() - this.startTime < this.timeout) && this.valid && (this.valid = !1), this.valid;
		}
	}, d1 = class {
		constructor(e, t) {
			this.width = e, this.height = t, this.array = [], this.array = new Array(e * t);
		}
		get(e, t) {
			return this.array[e + t * this.width];
		}
		set(e, t, n) {
			this.array[e + t * this.width] = n;
		}
	};
	function p1(e) {
		return e === 32 || e === 9;
	}
	var Ar = class S1 {
		static #e = this.chrKeys = /* @__PURE__ */ new Map();
		static getKey(t) {
			let n = this.chrKeys.get(t);
			return n === void 0 && (n = this.chrKeys.size, this.chrKeys.set(t, n)), n;
		}
		constructor(t, n, r) {
			this.range = t, this.lines = n, this.source = r, this.histogram = [];
			let s = 0;
			for (let a = t.startLineNumber - 1; a < t.endLineNumberExclusive - 1; a++) {
				const l = n[a];
				for (let u = 0; u < l.length; u++) {
					s++;
					const c = l[u], m = S1.getKey(c);
					this.histogram[m] = (this.histogram[m] || 0) + 1;
				}
				s++;
				const o = S1.getKey(`
`);
				this.histogram[o] = (this.histogram[o] || 0) + 1;
			}
			this.totalCount = s;
		}
		computeSimilarity(t) {
			let n = 0;
			const r = Math.max(this.histogram.length, t.histogram.length);
			for (let s = 0; s < r; s++) n += Math.abs((this.histogram[s] ?? 0) - (t.histogram[s] ?? 0));
			return 1 - n / (this.totalCount + t.totalCount);
		}
	}, xa = class {
		compute(e, t, n = g1.instance, r) {
			if (e.length === 0 || t.length === 0) return Be.trivial(e, t);
			const s = new d1(e.length, t.length), a = new d1(e.length, t.length), l = new d1(e.length, t.length);
			for (let f = 0; f < e.length; f++) for (let b = 0; b < t.length; b++) {
				if (!n.isValid()) return Be.trivialTimedOut(e, t);
				const p = f === 0 ? 0 : s.get(f - 1, b), y = b === 0 ? 0 : s.get(f, b - 1);
				let v;
				e.getElement(f) === t.getElement(b) ? (f === 0 || b === 0 ? v = 0 : v = s.get(f - 1, b - 1), f > 0 && b > 0 && a.get(f - 1, b - 1) === 3 && (v += l.get(f - 1, b - 1)), v += r ? r(f, b) : 1) : v = -1;
				const L = Math.max(p, y, v);
				if (L === v) {
					const _ = f > 0 && b > 0 ? l.get(f - 1, b - 1) : 0;
					l.set(f, b, _ + 1), a.set(f, b, 3);
				} else L === p ? (l.set(f, b, 0), a.set(f, b, 1)) : L === y && (l.set(f, b, 0), a.set(f, b, 2));
				s.set(f, b, L);
			}
			const o = [];
			let u = e.length, c = t.length;
			function m(f, b) {
				(f + 1 !== u || b + 1 !== c) && o.push(new re(new $(f + 1, u), new $(b + 1, c))), u = f, c = b;
			}
			let h = e.length - 1, d = t.length - 1;
			for (; h >= 0 && d >= 0;) a.get(h, d) === 3 ? (m(h, d), h--, d--) : a.get(h, d) === 1 ? h-- : d--;
			return m(-1, -1), o.reverse(), new Be(o, !1);
		}
	}, Cr = class {
		compute(e, t, n = g1.instance) {
			if (e.length === 0 || t.length === 0) return Be.trivial(e, t);
			const r = e, s = t;
			function a(b, p) {
				for (; b < r.length && p < s.length && r.getElement(b) === s.getElement(p);) b++, p++;
				return b;
			}
			let l = 0;
			const o = new ka();
			o.set(0, a(0, 0));
			const u = new Ma();
			u.set(0, o.get(0) === 0 ? null : new xr(null, 0, 0, o.get(0)));
			let c = 0;
			e: for (;;) {
				if (l++, !n.isValid()) return Be.trivialTimedOut(r, s);
				const b = -Math.min(l, s.length + l % 2), p = Math.min(l, r.length + l % 2);
				for (c = b; c <= p; c += 2) {
					const y = c === p ? -1 : o.get(c + 1), v = c === b ? -1 : o.get(c - 1) + 1, L = Math.min(Math.max(y, v), r.length), _ = L - c;
					if (L > r.length || _ > s.length) continue;
					const N = a(L, _);
					o.set(c, N);
					const k = L === y ? u.get(c + 1) : u.get(c - 1);
					if (u.set(c, N !== L ? new xr(k, L, _, N - L) : k), o.get(c) === r.length && o.get(c) - c === s.length) break e;
				}
			}
			let m = u.get(c);
			const h = [];
			let d = r.length, f = s.length;
			for (;;) {
				const b = m ? m.x + m.length : 0, p = m ? m.y + m.length : 0;
				if ((b !== d || p !== f) && h.push(new re(new $(b, d), new $(p, f))), !m) break;
				d = m.x, f = m.y, m = m.prev;
			}
			return h.reverse(), new Be(h, !1);
		}
	}, xr = class {
		constructor(e, t, n, r) {
			this.prev = e, this.x = t, this.y = n, this.length = r;
		}
	}, ka = class {
		constructor() {
			this.positiveArr = new Int32Array(10), this.negativeArr = new Int32Array(10);
		}
		get(e) {
			return e < 0 ? (e = -e - 1, this.negativeArr[e]) : this.positiveArr[e];
		}
		set(e, t) {
			if (e < 0) {
				if (e = -e - 1, e >= this.negativeArr.length) {
					const n = this.negativeArr;
					this.negativeArr = new Int32Array(n.length * 2), this.negativeArr.set(n);
				}
				this.negativeArr[e] = t;
			} else {
				if (e >= this.positiveArr.length) {
					const n = this.positiveArr;
					this.positiveArr = new Int32Array(n.length * 2), this.positiveArr.set(n);
				}
				this.positiveArr[e] = t;
			}
		}
	}, Ma = class {
		constructor() {
			this.positiveArr = [], this.negativeArr = [];
		}
		get(e) {
			return e < 0 ? (e = -e - 1, this.negativeArr[e]) : this.positiveArr[e];
		}
		set(e, t) {
			e < 0 ? (e = -e - 1, this.negativeArr[e] = t) : this.positiveArr[e] = t;
		}
	}, Lt = class {
		constructor(e, t, n) {
			this.lines = e, this.range = t, this.considerWhitespaceChanges = n, this.elements = [], this.firstElementOffsetByLineIdx = [], this.lineStartOffsets = [], this.trimmedWsLengthsByLineIdx = [], this.firstElementOffsetByLineIdx.push(0);
			for (let r = this.range.startLineNumber; r <= this.range.endLineNumber; r++) {
				let s = e[r - 1], a = 0;
				r === this.range.startLineNumber && this.range.startColumn > 1 && (a = this.range.startColumn - 1, s = s.substring(a)), this.lineStartOffsets.push(a);
				let l = 0;
				if (!n) {
					const u = s.trimStart();
					l = s.length - u.length, s = u.trimEnd();
				}
				this.trimmedWsLengthsByLineIdx.push(l);
				const o = r === this.range.endLineNumber ? Math.min(this.range.endColumn - 1 - a - l, s.length) : s.length;
				for (let u = 0; u < o; u++) this.elements.push(s.charCodeAt(u));
				r < this.range.endLineNumber && (this.elements.push(10), this.firstElementOffsetByLineIdx.push(this.elements.length));
			}
		}
		toString() {
			return `Slice: "${this.text}"`;
		}
		get text() {
			return this.getText(new $(0, this.length));
		}
		getText(e) {
			return this.elements.slice(e.start, e.endExclusive).map((t) => String.fromCharCode(t)).join("");
		}
		getElement(e) {
			return this.elements[e];
		}
		get length() {
			return this.elements.length;
		}
		getBoundaryScore(e) {
			const t = Er(e > 0 ? this.elements[e - 1] : -1), n = Er(e < this.elements.length ? this.elements[e] : -1);
			if (t === 7 && n === 8) return 0;
			if (t === 8) return 150;
			let r = 0;
			return t !== n && (r += 10, t === 0 && n === 1 && (r += 1)), r += Mr(t), r += Mr(n), r;
		}
		translateOffset(e, t = "right") {
			const n = Fe(this.firstElementOffsetByLineIdx, (s) => s <= e), r = e - this.firstElementOffsetByLineIdx[n];
			return new W(this.range.startLineNumber + n, 1 + this.lineStartOffsets[n] + r + (r === 0 && t === "left" ? 0 : this.trimmedWsLengthsByLineIdx[n]));
		}
		translateRange(e) {
			const t = this.translateOffset(e.start, "right"), n = this.translateOffset(e.endExclusive, "left");
			return n.isBefore(t) ? I.fromPositions(n, n) : I.fromPositions(t, n);
		}
		findWordContaining(e) {
			if (e < 0 || e >= this.elements.length || !qe(this.elements[e])) return;
			let t = e;
			for (; t > 0 && qe(this.elements[t - 1]);) t--;
			let n = e;
			for (; n < this.elements.length && qe(this.elements[n]);) n++;
			return new $(t, n);
		}
		findSubWordContaining(e) {
			if (e < 0 || e >= this.elements.length || !qe(this.elements[e])) return;
			let t = e;
			for (; t > 0 && qe(this.elements[t - 1]) && !kr(this.elements[t]);) t--;
			let n = e;
			for (; n < this.elements.length && qe(this.elements[n]) && !kr(this.elements[n]);) n++;
			return new $(t, n);
		}
		countLinesIn(e) {
			return this.translateOffset(e.endExclusive).lineNumber - this.translateOffset(e.start).lineNumber;
		}
		isStronglyEqual(e, t) {
			return this.elements[e] === this.elements[t];
		}
		extendToFullLines(e) {
			return new $(Te(this.firstElementOffsetByLineIdx, (t) => t <= e.start) ?? 0, da(this.firstElementOffsetByLineIdx, (t) => e.endExclusive <= t) ?? this.elements.length);
		}
	};
	function qe(e) {
		return e >= 97 && e <= 122 || e >= 65 && e <= 90 || e >= 48 && e <= 57;
	}
	function kr(e) {
		return e >= 65 && e <= 90;
	}
	const Ea = {
		0: 0,
		1: 0,
		2: 0,
		3: 10,
		4: 2,
		5: 30,
		6: 3,
		7: 10,
		8: 10
	};
	function Mr(e) {
		return Ea[e];
	}
	function Er(e) {
		return e === 10 ? 8 : e === 13 ? 7 : p1(e) ? 6 : e >= 97 && e <= 122 ? 0 : e >= 65 && e <= 90 ? 1 : e >= 48 && e <= 57 ? 2 : e === -1 ? 3 : e === 44 || e === 59 ? 5 : 4;
	}
	function Pa(e, t, n, r, s, a) {
		let { moves: l, excludedChanges: o } = Ta(e, t, n, a);
		if (!a.isValid()) return [];
		const u = Fa(e.filter((c) => !o.has(c)), r, s, t, n, a);
		return fa(l, u), l = Ia(l), l = l.filter((c) => {
			const m = c.original.toOffsetRange().slice(t).map((h) => h.trim());
			return m.join(`
`).length >= 15 && Da(m, (h) => h.length >= 2) >= 2;
		}), l = Va(e, l), l;
	}
	function Da(e, t) {
		let n = 0;
		for (const r of e) t(r) && n++;
		return n;
	}
	function Ta(e, t, n, r) {
		const s = [], a = e.filter((u) => u.modified.isEmpty && u.original.length >= 3).map((u) => new Ar(u.original, t, u)), l = new Set(e.filter((u) => u.original.isEmpty && u.modified.length >= 3).map((u) => new Ar(u.modified, n, u))), o = /* @__PURE__ */ new Set();
		for (const u of a) {
			let c = -1, m;
			for (const h of l) {
				const d = u.computeSimilarity(h);
				d > c && (c = d, m = h);
			}
			if (c > .9 && m && (l.delete(m), s.push(new Ie(u.range, m.range)), o.add(u.source), o.add(m.source)), !r.isValid()) return {
				moves: s,
				excludedChanges: o
			};
		}
		return {
			moves: s,
			excludedChanges: o
		};
	}
	function Fa(e, t, n, r, s, a) {
		const l = [], o = new Ji();
		for (const d of e) for (let f = d.original.startLineNumber; f < d.original.endLineNumberExclusive - 2; f++) {
			const b = `${t[f - 1]}:${t[f + 1 - 1]}:${t[f + 2 - 1]}`;
			o.add(b, { range: new q(f, f + 3) });
		}
		const u = [];
		e.sort(je((d) => d.modified.startLineNumber, Xe));
		for (const d of e) {
			let f = [];
			for (let b = d.modified.startLineNumber; b < d.modified.endLineNumberExclusive - 2; b++) {
				const p = `${n[b - 1]}:${n[b + 1 - 1]}:${n[b + 2 - 1]}`, y = new q(b, b + 3), v = [];
				o.forEach(p, ({ range: L }) => {
					for (const N of f) if (N.originalLineRange.endLineNumberExclusive + 1 === L.endLineNumberExclusive && N.modifiedLineRange.endLineNumberExclusive + 1 === y.endLineNumberExclusive) {
						N.originalLineRange = new q(N.originalLineRange.startLineNumber, L.endLineNumberExclusive), N.modifiedLineRange = new q(N.modifiedLineRange.startLineNumber, y.endLineNumberExclusive), v.push(N);
						return;
					}
					const _ = {
						modifiedLineRange: y,
						originalLineRange: L
					};
					u.push(_), v.push(_);
				}), f = v;
			}
			if (!a.isValid()) return [];
		}
		u.sort(ga(je((d) => d.modifiedLineRange.length, Xe)));
		const c = new wt(), m = new wt();
		for (const d of u) {
			const f = d.modifiedLineRange.startLineNumber - d.originalLineRange.startLineNumber, b = c.subtractFrom(d.modifiedLineRange), p = m.subtractFrom(d.originalLineRange).getWithDelta(f), y = b.getIntersection(p);
			for (const v of y.ranges) {
				if (v.length < 3) continue;
				const L = v, _ = v.delta(-f);
				l.push(new Ie(_, L)), c.addRange(L), m.addRange(_);
			}
		}
		l.sort(je((d) => d.original.startLineNumber, Xe));
		const h = new _r(e);
		for (let d = 0; d < l.length; d++) {
			const f = l[d], b = h.findLastMonotonous((M) => M.original.startLineNumber <= f.original.startLineNumber), p = Te(e, (M) => M.modified.startLineNumber <= f.modified.startLineNumber), y = Math.max(f.original.startLineNumber - b.original.startLineNumber, f.modified.startLineNumber - p.modified.startLineNumber), v = h.findLastMonotonous((M) => M.original.startLineNumber < f.original.endLineNumberExclusive), L = Te(e, (M) => M.modified.startLineNumber < f.modified.endLineNumberExclusive), _ = Math.max(v.original.endLineNumberExclusive - f.original.endLineNumberExclusive, L.modified.endLineNumberExclusive - f.modified.endLineNumberExclusive);
			let N;
			for (N = 0; N < y; N++) {
				const M = f.original.startLineNumber - N - 1, w = f.modified.startLineNumber - N - 1;
				if (M > r.length || w > s.length || c.contains(w) || m.contains(M) || !Pr(r[M - 1], s[w - 1], a)) break;
			}
			N > 0 && (m.addRange(new q(f.original.startLineNumber - N, f.original.startLineNumber)), c.addRange(new q(f.modified.startLineNumber - N, f.modified.startLineNumber)));
			let k;
			for (k = 0; k < _; k++) {
				const M = f.original.endLineNumberExclusive + k, w = f.modified.endLineNumberExclusive + k;
				if (M > r.length || w > s.length || c.contains(w) || m.contains(M) || !Pr(r[M - 1], s[w - 1], a)) break;
			}
			k > 0 && (m.addRange(new q(f.original.endLineNumberExclusive, f.original.endLineNumberExclusive + k)), c.addRange(new q(f.modified.endLineNumberExclusive, f.modified.endLineNumberExclusive + k))), (N > 0 || k > 0) && (l[d] = new Ie(new q(f.original.startLineNumber - N, f.original.endLineNumberExclusive + k), new q(f.modified.startLineNumber - N, f.modified.endLineNumberExclusive + k)));
		}
		return l;
	}
	function Pr(e, t, n) {
		if (e.trim() === t.trim()) return !0;
		if (e.length > 300 && t.length > 300) return !1;
		const r = new Cr().compute(new Lt([e], new I(1, 1, 1, e.length), !1), new Lt([t], new I(1, 1, 1, t.length), !1), n);
		let s = 0;
		const a = re.invert(r.diffs, e.length);
		for (const u of a) u.seq1Range.forEach((c) => {
			p1(e.charCodeAt(c)) || s++;
		});
		function l(u) {
			let c = 0;
			for (let m = 0; m < e.length; m++) p1(u.charCodeAt(m)) || c++;
			return c;
		}
		const o = l(e.length > t.length ? e : t);
		return s / o > .6 && o > 10;
	}
	function Ia(e) {
		if (e.length === 0) return e;
		e.sort(je((n) => n.original.startLineNumber, Xe));
		const t = [e[0]];
		for (let n = 1; n < e.length; n++) {
			const r = t[t.length - 1], s = e[n], a = s.original.startLineNumber - r.original.endLineNumberExclusive, l = s.modified.startLineNumber - r.modified.endLineNumberExclusive;
			if (a >= 0 && l >= 0 && a + l <= 2) {
				t[t.length - 1] = r.join(s);
				continue;
			}
			t.push(s);
		}
		return t;
	}
	function Va(e, t) {
		const n = new _r(e);
		return t = t.filter((r) => (n.findLastMonotonous((s) => s.original.startLineNumber < r.original.endLineNumberExclusive) || new Ie(new q(1, 1), new q(1, 1))) !== Te(e, (s) => s.modified.startLineNumber < r.modified.endLineNumberExclusive)), t;
	}
	function Dr(e, t, n) {
		let r = n;
		return r = Tr(e, t, r), r = Tr(e, t, r), r = Ba(e, t, r), r;
	}
	function Tr(e, t, n) {
		if (n.length === 0) return n;
		const r = [];
		r.push(n[0]);
		for (let a = 1; a < n.length; a++) {
			const l = r[r.length - 1];
			let o = n[a];
			if (o.seq1Range.isEmpty || o.seq2Range.isEmpty) {
				const u = o.seq1Range.start - l.seq1Range.endExclusive;
				let c;
				for (c = 1; c <= u && !(e.getElement(o.seq1Range.start - c) !== e.getElement(o.seq1Range.endExclusive - c) || t.getElement(o.seq2Range.start - c) !== t.getElement(o.seq2Range.endExclusive - c)); c++);
				if (c--, c === u) {
					r[r.length - 1] = new re(new $(l.seq1Range.start, o.seq1Range.endExclusive - u), new $(l.seq2Range.start, o.seq2Range.endExclusive - u));
					continue;
				}
				o = o.delta(-c);
			}
			r.push(o);
		}
		const s = [];
		for (let a = 0; a < r.length - 1; a++) {
			const l = r[a + 1];
			let o = r[a];
			if (o.seq1Range.isEmpty || o.seq2Range.isEmpty) {
				const u = l.seq1Range.start - o.seq1Range.endExclusive;
				let c;
				for (c = 0; c < u && !(!e.isStronglyEqual(o.seq1Range.start + c, o.seq1Range.endExclusive + c) || !t.isStronglyEqual(o.seq2Range.start + c, o.seq2Range.endExclusive + c)); c++);
				if (c === u) {
					r[a + 1] = new re(new $(o.seq1Range.start + u, l.seq1Range.endExclusive), new $(o.seq2Range.start + u, l.seq2Range.endExclusive));
					continue;
				}
				c > 0 && (o = o.delta(c));
			}
			s.push(o);
		}
		return r.length > 0 && s.push(r[r.length - 1]), s;
	}
	function Ba(e, t, n) {
		if (!e.getBoundaryScore || !t.getBoundaryScore) return n;
		for (let r = 0; r < n.length; r++) {
			const s = r > 0 ? n[r - 1] : void 0, a = n[r], l = r + 1 < n.length ? n[r + 1] : void 0, o = new $(s ? s.seq1Range.endExclusive + 1 : 0, l ? l.seq1Range.start - 1 : e.length), u = new $(s ? s.seq2Range.endExclusive + 1 : 0, l ? l.seq2Range.start - 1 : t.length);
			a.seq1Range.isEmpty ? n[r] = Fr(a, e, t, o, u) : a.seq2Range.isEmpty && (n[r] = Fr(a.swap(), t, e, u, o).swap());
		}
		return n;
	}
	function Fr(e, t, n, r, s) {
		let l = 1;
		for (; e.seq1Range.start - l >= r.start && e.seq2Range.start - l >= s.start && n.isStronglyEqual(e.seq2Range.start - l, e.seq2Range.endExclusive - l) && l < 100;) l++;
		l--;
		let o = 0;
		for (; e.seq1Range.start + o < r.endExclusive && e.seq2Range.endExclusive + o < s.endExclusive && n.isStronglyEqual(e.seq2Range.start + o, e.seq2Range.endExclusive + o) && o < 100;) o++;
		if (l === 0 && o === 0) return e;
		let u = 0, c = -1;
		for (let m = -l; m <= o; m++) {
			const h = e.seq2Range.start + m, d = e.seq2Range.endExclusive + m, f = e.seq1Range.start + m, b = t.getBoundaryScore(f) + n.getBoundaryScore(h) + n.getBoundaryScore(d);
			b > c && (c = b, u = m);
		}
		return e.delta(u);
	}
	function qa(e, t, n) {
		const r = [];
		for (const s of n) {
			const a = r[r.length - 1];
			if (!a) {
				r.push(s);
				continue;
			}
			s.seq1Range.start - a.seq1Range.endExclusive <= 2 || s.seq2Range.start - a.seq2Range.endExclusive <= 2 ? r[r.length - 1] = new re(a.seq1Range.join(s.seq1Range), a.seq2Range.join(s.seq2Range)) : r.push(s);
		}
		return r;
	}
	function Ir(e, t, n, r, s = !1) {
		const a = re.invert(n, e.length), l = [];
		let o = new Se(0, 0);
		function u(c, m) {
			if (c.offset1 < o.offset1 || c.offset2 < o.offset2) return;
			const h = r(e, c.offset1), d = r(t, c.offset2);
			if (!h || !d) return;
			let f = new re(h, d);
			const b = f.intersect(m);
			let p = b.seq1Range.length, y = b.seq2Range.length;
			for (; a.length > 0;) {
				const v = a[0];
				if (!(v.seq1Range.intersects(f.seq1Range) || v.seq2Range.intersects(f.seq2Range))) break;
				const L = new re(r(e, v.seq1Range.start), r(t, v.seq2Range.start)), _ = L.intersect(v);
				if (p += _.seq1Range.length, y += _.seq2Range.length, f = f.join(L), f.seq1Range.endExclusive >= v.seq1Range.endExclusive) a.shift();
				else break;
			}
			(s && p + y < f.seq1Range.length + f.seq2Range.length || p + y < (f.seq1Range.length + f.seq2Range.length) * 2 / 3) && l.push(f), o = f.getEndExclusives();
		}
		for (; a.length > 0;) {
			const c = a.shift();
			c.seq1Range.isEmpty || (u(c.getStarts(), c), u(c.getEndExclusives().delta(-1), c));
		}
		return Ua(n, l);
	}
	function Ua(e, t) {
		const n = [];
		for (; e.length > 0 || t.length > 0;) {
			const r = e[0], s = t[0];
			let a;
			r && (!s || r.seq1Range.start < s.seq1Range.start) ? a = e.shift() : a = t.shift(), n.length > 0 && n[n.length - 1].seq1Range.endExclusive >= a.seq1Range.start ? n[n.length - 1] = n[n.length - 1].join(a) : n.push(a);
		}
		return n;
	}
	function Ha(e, t, n) {
		let r = n;
		if (r.length === 0) return r;
		let s = 0, a;
		do {
			a = !1;
			const o = [r[0]];
			for (let u = 1; u < r.length; u++) {
				let h = function(d, f) {
					const b = new $(m.seq1Range.endExclusive, c.seq1Range.start);
					return e.getText(b).replace(/\s/g, "").length <= 4 && (d.seq1Range.length + d.seq2Range.length > 5 || f.seq1Range.length + f.seq2Range.length > 5);
				};
				const c = r[u], m = o[o.length - 1];
				h(m, c) ? (a = !0, o[o.length - 1] = o[o.length - 1].join(c)) : o.push(c);
			}
			r = o;
		} while (s++ < 10 && a);
		return r;
	}
	function Wa(e, t, n) {
		let r = n;
		if (r.length === 0) return r;
		let s = 0, a;
		do {
			a = !1;
			const u = [r[0]];
			for (let c = 1; c < r.length; c++) {
				let d = function(f, b) {
					const p = new $(h.seq1Range.endExclusive, m.seq1Range.start);
					if (e.countLinesIn(p) > 5 || p.length > 500) return !1;
					const y = e.getText(p).trim();
					if (y.length > 20 || y.split(/\r\n|\r|\n/).length > 1) return !1;
					const v = e.countLinesIn(f.seq1Range), L = f.seq1Range.length, _ = t.countLinesIn(f.seq2Range), N = f.seq2Range.length, k = e.countLinesIn(b.seq1Range), M = b.seq1Range.length, w = t.countLinesIn(b.seq2Range), C = b.seq2Range.length, T = 130;
					function U(x) {
						return Math.min(x, T);
					}
					return Math.pow(Math.pow(U(v * 40 + L), 1.5) + Math.pow(U(_ * 40 + N), 1.5), 1.5) + Math.pow(Math.pow(U(k * 40 + M), 1.5) + Math.pow(U(w * 40 + C), 1.5), 1.5) > (T ** 1.5) ** 1.5 * 1.3;
				};
				const m = r[c], h = u[u.length - 1];
				d(h, m) ? (a = !0, u[u.length - 1] = u[u.length - 1].join(m)) : u.push(m);
			}
			r = u;
		} while (s++ < 10 && a);
		const l = [];
		return ma(r, (u, c, m) => {
			let h = c;
			function d(L) {
				return L.length > 0 && L.trim().length <= 3 && c.seq1Range.length + c.seq2Range.length > 100;
			}
			const f = e.extendToFullLines(c.seq1Range), b = e.getText(new $(f.start, c.seq1Range.start));
			d(b) && (h = h.deltaStart(-b.length));
			const p = e.getText(new $(c.seq1Range.endExclusive, f.endExclusive));
			d(p) && (h = h.deltaEnd(p.length));
			const y = re.fromOffsetPairs(u ? u.getEndExclusives() : Se.zero, m ? m.getStarts() : Se.max), v = h.intersect(y);
			l.length > 0 && v.getStarts().equals(l[l.length - 1].getEndExclusives()) ? l[l.length - 1] = l[l.length - 1].join(v) : l.push(v);
		}), l;
	}
	var Vr = class {
		constructor(e, t) {
			this.trimmedHash = e, this.lines = t;
		}
		getElement(e) {
			return this.trimmedHash[e];
		}
		get length() {
			return this.trimmedHash.length;
		}
		getBoundaryScore(e) {
			return 1e3 - ((e === 0 ? 0 : Br(this.lines[e - 1])) + (e === this.lines.length ? 0 : Br(this.lines[e])));
		}
		getText(e) {
			return this.lines.slice(e.start, e.endExclusive).join(`
`);
		}
		isStronglyEqual(e, t) {
			return this.lines[e] === this.lines[t];
		}
	};
	function Br(e) {
		let t = 0;
		for (; t < e.length && (e.charCodeAt(t) === 32 || e.charCodeAt(t) === 9);) t++;
		return t;
	}
	var $a = class {
		constructor() {
			this.dynamicProgrammingDiffing = new xa(), this.myersDiffingAlgorithm = new Cr();
		}
		computeDiff(e, t, n) {
			if (e.length <= 1 && ua(e, t, (N, k) => N === k)) return new bt([], [], !1);
			if (e.length === 1 && e[0].length === 0 || t.length === 1 && t[0].length === 0) return new bt([new Qe(new q(1, e.length + 1), new q(1, t.length + 1), [new de(new I(1, 1, e.length, e[e.length - 1].length + 1), new I(1, 1, t.length, t[t.length - 1].length + 1))])], [], !1);
			const r = n.maxComputationTimeMs === 0 ? g1.instance : new Ca(n.maxComputationTimeMs), s = !n.ignoreTrimWhitespace, a = /* @__PURE__ */ new Map();
			function l(N) {
				let k = a.get(N);
				return k === void 0 && (k = a.size, a.set(N, k)), k;
			}
			const o = e.map((N) => l(N.trim())), u = t.map((N) => l(N.trim())), c = new Vr(o, e), m = new Vr(u, t), h = c.length + m.length < 1700 ? this.dynamicProgrammingDiffing.compute(c, m, r, (N, k) => e[N] === t[k] ? t[k].length === 0 ? .1 : 1 + Math.log(1 + t[k].length) : .99) : this.myersDiffingAlgorithm.compute(c, m, r);
			let d = h.diffs, f = h.hitTimeout;
			d = Dr(c, m, d), d = Ha(c, m, d);
			const b = [], p = (N) => {
				if (s) for (let k = 0; k < N; k++) {
					const M = y + k, w = v + k;
					if (e[M] !== t[w]) {
						const C = this.refineDiff(e, t, new re(new $(M, M + 1), new $(w, w + 1)), r, s, n);
						for (const T of C.mappings) b.push(T);
						C.hitTimeout && (f = !0);
					}
				}
			};
			let y = 0, v = 0;
			for (const N of d) {
				st(() => N.seq1Range.start - y === N.seq2Range.start - v), p(N.seq1Range.start - y), y = N.seq1Range.endExclusive, v = N.seq2Range.endExclusive;
				const k = this.refineDiff(e, t, N, r, s, n);
				k.hitTimeout && (f = !0);
				for (const M of k.mappings) b.push(M);
			}
			p(e.length - y);
			const L = Lr(b, new _t(e), new _t(t));
			let _ = [];
			return n.computeMoves && (_ = this.computeMoves(L, e, t, o, u, r, s, n)), st(() => {
				function N(M, w) {
					if (M.lineNumber < 1 || M.lineNumber > w.length) return !1;
					const C = w[M.lineNumber - 1];
					return !(M.column < 1 || M.column > C.length + 1);
				}
				function k(M, w) {
					return !(M.startLineNumber < 1 || M.startLineNumber > w.length + 1 || M.endLineNumberExclusive < 1 || M.endLineNumberExclusive > w.length + 1);
				}
				for (const M of L) {
					if (!M.innerChanges) return !1;
					for (const w of M.innerChanges) if (!(N(w.modifiedRange.getStartPosition(), t) && N(w.modifiedRange.getEndPosition(), t) && N(w.originalRange.getStartPosition(), e) && N(w.originalRange.getEndPosition(), e))) return !1;
					if (!k(M.modified, t) || !k(M.original, e)) return !1;
				}
				return !0;
			}), new bt(L, _, f);
		}
		computeMoves(e, t, n, r, s, a, l, o) {
			return Pa(e, t, n, r, s, a).map((u) => new oa(u, Lr(this.refineDiff(t, n, new re(u.original.toOffsetRange(), u.modified.toOffsetRange()), a, l, o).mappings, new _t(t), new _t(n), !0)));
		}
		refineDiff(e, t, n, r, s, a) {
			const l = za(n).toRangeMapping2(e, t), o = new Lt(e, l.originalRange, s), u = new Lt(t, l.modifiedRange, s), c = o.length + u.length < 500 ? this.dynamicProgrammingDiffing.compute(o, u, r) : this.myersDiffingAlgorithm.compute(o, u, r);
			let m = c.diffs;
			return m = Dr(o, u, m), m = Ir(o, u, m, (h, d) => h.findWordContaining(d)), a.extendToSubwords && (m = Ir(o, u, m, (h, d) => h.findSubWordContaining(d), !0)), m = qa(o, u, m), m = Wa(o, u, m), {
				mappings: m.map((h) => new de(o.translateRange(h.seq1Range), u.translateRange(h.seq2Range))),
				hitTimeout: c.hitTimeout
			};
		}
	};
	function za(e) {
		return new Ie(new q(e.seq1Range.start + 1, e.seq1Range.endExclusive + 1), new q(e.seq2Range.start + 1, e.seq2Range.endExclusive + 1));
	}
	const qr = {
		getLegacy: () => new Na(),
		getDefault: () => new $a()
	};
	function _e(e, t) {
		const n = Math.pow(10, t);
		return Math.round(e * n) / n;
	}
	var g = class {
		constructor(e, t, n, r = 1) {
			this._rgbaBrand = void 0, this.r = Math.min(255, Math.max(0, e)) | 0, this.g = Math.min(255, Math.max(0, t)) | 0, this.b = Math.min(255, Math.max(0, n)) | 0, this.a = _e(Math.max(Math.min(1, r), 0), 3);
		}
		static equals(e, t) {
			return e.r === t.r && e.g === t.g && e.b === t.b && e.a === t.a;
		}
	}, Re = class nt {
		constructor(t, n, r, s) {
			this._hslaBrand = void 0, this.h = Math.max(Math.min(360, t), 0) | 0, this.s = _e(Math.max(Math.min(1, n), 0), 3), this.l = _e(Math.max(Math.min(1, r), 0), 3), this.a = _e(Math.max(Math.min(1, s), 0), 3);
		}
		static equals(t, n) {
			return t.h === n.h && t.s === n.s && t.l === n.l && t.a === n.a;
		}
		static fromRGBA(t) {
			const n = t.r / 255, r = t.g / 255, s = t.b / 255, a = t.a, l = Math.max(n, r, s), o = Math.min(n, r, s);
			let u = 0, c = 0;
			const m = (o + l) / 2, h = l - o;
			if (h > 0) {
				switch (c = Math.min(m <= .5 ? h / (2 * m) : h / (2 - 2 * m), 1), l) {
					case n:
						u = (r - s) / h + (r < s ? 6 : 0);
						break;
					case r:
						u = (s - n) / h + 2;
						break;
					case s:
						u = (n - r) / h + 4;
						break;
				}
				u *= 60, u = Math.round(u);
			}
			return new nt(u, c, m, a);
		}
		static _hue2rgb(t, n, r) {
			return r < 0 && (r += 1), r > 1 && (r -= 1), r < 1 / 6 ? t + (n - t) * 6 * r : r < 1 / 2 ? n : r < 2 / 3 ? t + (n - t) * (2 / 3 - r) * 6 : t;
		}
		static toRGBA(t) {
			const n = t.h / 360, { s: r, l: s, a } = t;
			let l, o, u;
			if (r === 0) l = o = u = s;
			else {
				const c = s < .5 ? s * (1 + r) : s + r - s * r, m = 2 * s - c;
				l = nt._hue2rgb(m, c, n + 1 / 3), o = nt._hue2rgb(m, c, n), u = nt._hue2rgb(m, c, n - 1 / 3);
			}
			return new g(Math.round(l * 255), Math.round(o * 255), Math.round(u * 255), a);
		}
	}, Nt = class ss {
		constructor(t, n, r, s) {
			this._hsvaBrand = void 0, this.h = Math.max(Math.min(360, t), 0) | 0, this.s = _e(Math.max(Math.min(1, n), 0), 3), this.v = _e(Math.max(Math.min(1, r), 0), 3), this.a = _e(Math.max(Math.min(1, s), 0), 3);
		}
		static equals(t, n) {
			return t.h === n.h && t.s === n.s && t.v === n.v && t.a === n.a;
		}
		static fromRGBA(t) {
			const n = t.r / 255, r = t.g / 255, s = t.b / 255, a = Math.max(n, r, s), l = a - Math.min(n, r, s), o = a === 0 ? 0 : l / a;
			let u;
			return l === 0 ? u = 0 : a === n ? u = ((r - s) / l % 6 + 6) % 6 : a === r ? u = (s - n) / l + 2 : u = (n - r) / l + 4, new ss(Math.round(u * 60), o, a, t.a);
		}
		static toRGBA(t) {
			const { h: n, s: r, v: s, a } = t, l = s * r, o = l * (1 - Math.abs(n / 60 % 2 - 1)), u = s - l;
			let [c, m, h] = [
				0,
				0,
				0
			];
			return n < 60 ? (c = l, m = o) : n < 120 ? (c = o, m = l) : n < 180 ? (m = l, h = o) : n < 240 ? (m = o, h = l) : n < 300 ? (c = o, h = l) : n <= 360 && (c = l, h = o), c = Math.round((c + u) * 255), m = Math.round((m + u) * 255), h = Math.round((h + u) * 255), new g(c, m, h, a);
		}
	}, St = class X {
		static fromHex(t) {
			return X.Format.CSS.parseHex(t) || X.red;
		}
		static equals(t, n) {
			return !t && !n ? !0 : !t || !n ? !1 : t.equals(n);
		}
		get hsla() {
			return this._hsla ? this._hsla : Re.fromRGBA(this.rgba);
		}
		get hsva() {
			return this._hsva ? this._hsva : Nt.fromRGBA(this.rgba);
		}
		constructor(t) {
			if (t) if (t instanceof g) this.rgba = t;
			else if (t instanceof Re) this._hsla = t, this.rgba = Re.toRGBA(t);
			else if (t instanceof Nt) this._hsva = t, this.rgba = Nt.toRGBA(t);
			else throw new Error("Invalid color ctor argument");
			else throw new Error("Color needs a value");
		}
		equals(t) {
			return !!t && g.equals(this.rgba, t.rgba) && Re.equals(this.hsla, t.hsla) && Nt.equals(this.hsva, t.hsva);
		}
		getRelativeLuminance() {
			const t = X._relativeLuminanceForComponent(this.rgba.r), n = X._relativeLuminanceForComponent(this.rgba.g), r = X._relativeLuminanceForComponent(this.rgba.b);
			return _e(.2126 * t + .7152 * n + .0722 * r, 4);
		}
		static _relativeLuminanceForComponent(t) {
			const n = t / 255;
			return n <= .03928 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4);
		}
		isLighter() {
			return (this.rgba.r * 299 + this.rgba.g * 587 + this.rgba.b * 114) / 1e3 >= 128;
		}
		isLighterThan(t) {
			return this.getRelativeLuminance() > t.getRelativeLuminance();
		}
		isDarkerThan(t) {
			return this.getRelativeLuminance() < t.getRelativeLuminance();
		}
		lighten(t) {
			return new X(new Re(this.hsla.h, this.hsla.s, this.hsla.l + this.hsla.l * t, this.hsla.a));
		}
		darken(t) {
			return new X(new Re(this.hsla.h, this.hsla.s, this.hsla.l - this.hsla.l * t, this.hsla.a));
		}
		transparent(t) {
			const { r: n, g: r, b: s, a } = this.rgba;
			return new X(new g(n, r, s, a * t));
		}
		isTransparent() {
			return this.rgba.a === 0;
		}
		isOpaque() {
			return this.rgba.a === 1;
		}
		opposite() {
			return new X(new g(255 - this.rgba.r, 255 - this.rgba.g, 255 - this.rgba.b, this.rgba.a));
		}
		mix(t, n = .5) {
			const r = Math.min(Math.max(n, 0), 1), s = this.rgba, a = t.rgba;
			return new X(new g(s.r + (a.r - s.r) * r, s.g + (a.g - s.g) * r, s.b + (a.b - s.b) * r, s.a + (a.a - s.a) * r));
		}
		makeOpaque(t) {
			if (this.isOpaque() || t.rgba.a !== 1) return this;
			const { r: n, g: r, b: s, a } = this.rgba;
			return new X(new g(t.rgba.r - a * (t.rgba.r - n), t.rgba.g - a * (t.rgba.g - r), t.rgba.b - a * (t.rgba.b - s), 1));
		}
		toString() {
			return this._toString || (this._toString = X.Format.CSS.format(this)), this._toString;
		}
		toNumber32Bit() {
			return this._toNumber32Bit || (this._toNumber32Bit = (this.rgba.r << 24 | this.rgba.g << 16 | this.rgba.b << 8 | this.rgba.a * 255 << 0) >>> 0), this._toNumber32Bit;
		}
		static getLighterColor(t, n, r) {
			if (t.isLighterThan(n)) return t;
			r = r || .5;
			const s = t.getRelativeLuminance(), a = n.getRelativeLuminance();
			return r = r * (a - s) / a, t.lighten(r);
		}
		static getDarkerColor(t, n, r) {
			if (t.isDarkerThan(n)) return t;
			r = r || .5;
			const s = t.getRelativeLuminance(), a = n.getRelativeLuminance();
			return r = r * (s - a) / s, t.darken(r);
		}
		static #e = this.white = new X(new g(255, 255, 255, 1));
		static #t = this.black = new X(new g(0, 0, 0, 1));
		static #n = this.red = new X(new g(255, 0, 0, 1));
		static #r = this.blue = new X(new g(0, 0, 255, 1));
		static #s = this.green = new X(new g(0, 255, 0, 1));
		static #i = this.cyan = new X(new g(0, 255, 255, 1));
		static #a = this.lightgrey = new X(new g(211, 211, 211, 1));
		static #l = this.transparent = new X(new g(0, 0, 0, 0));
	};
	(function(e) {
		(function(t) {
			(function(n) {
				function r(p) {
					return p.rgba.a === 1 ? `rgb(${p.rgba.r}, ${p.rgba.g}, ${p.rgba.b})` : e.Format.CSS.formatRGBA(p);
				}
				n.formatRGB = r;
				function s(p) {
					return `rgba(${p.rgba.r}, ${p.rgba.g}, ${p.rgba.b}, ${+p.rgba.a.toFixed(2)})`;
				}
				n.formatRGBA = s;
				function a(p) {
					return p.hsla.a === 1 ? `hsl(${p.hsla.h}, ${Math.round(p.hsla.s * 100)}%, ${Math.round(p.hsla.l * 100)}%)` : e.Format.CSS.formatHSLA(p);
				}
				n.formatHSL = a;
				function l(p) {
					return `hsla(${p.hsla.h}, ${Math.round(p.hsla.s * 100)}%, ${Math.round(p.hsla.l * 100)}%, ${p.hsla.a.toFixed(2)})`;
				}
				n.formatHSLA = l;
				function o(p) {
					const y = p.toString(16);
					return y.length !== 2 ? "0" + y : y;
				}
				function u(p) {
					return `#${o(p.rgba.r)}${o(p.rgba.g)}${o(p.rgba.b)}`;
				}
				n.formatHex = u;
				function c(p, y = !1) {
					return y && p.rgba.a === 1 ? e.Format.CSS.formatHex(p) : `#${o(p.rgba.r)}${o(p.rgba.g)}${o(p.rgba.b)}${o(Math.round(p.rgba.a * 255))}`;
				}
				n.formatHexA = c;
				function m(p) {
					return p.isOpaque() ? e.Format.CSS.formatHex(p) : e.Format.CSS.formatRGBA(p);
				}
				n.format = m;
				function h(p) {
					if (p === "transparent") return e.transparent;
					if (p.startsWith("#")) return f(p);
					if (p.startsWith("rgba(")) {
						const y = p.match(/rgba\((?<r>(?:\+|-)?\d+), *(?<g>(?:\+|-)?\d+), *(?<b>(?:\+|-)?\d+), *(?<a>(?:\+|-)?\d+(\.\d+)?)\)/);
						if (!y) throw new Error("Invalid color format " + p);
						return new e(new g(parseInt(y.groups?.r ?? "0"), parseInt(y.groups?.g ?? "0"), parseInt(y.groups?.b ?? "0"), parseFloat(y.groups?.a ?? "0")));
					}
					if (p.startsWith("rgb(")) {
						const y = p.match(/rgb\((?<r>(?:\+|-)?\d+), *(?<g>(?:\+|-)?\d+), *(?<b>(?:\+|-)?\d+)\)/);
						if (!y) throw new Error("Invalid color format " + p);
						return new e(new g(parseInt(y.groups?.r ?? "0"), parseInt(y.groups?.g ?? "0"), parseInt(y.groups?.b ?? "0")));
					}
					return d(p);
				}
				n.parse = h;
				function d(p) {
					switch (p) {
						case "aliceblue": return new e(new g(240, 248, 255, 1));
						case "antiquewhite": return new e(new g(250, 235, 215, 1));
						case "aqua": return new e(new g(0, 255, 255, 1));
						case "aquamarine": return new e(new g(127, 255, 212, 1));
						case "azure": return new e(new g(240, 255, 255, 1));
						case "beige": return new e(new g(245, 245, 220, 1));
						case "bisque": return new e(new g(255, 228, 196, 1));
						case "black": return new e(new g(0, 0, 0, 1));
						case "blanchedalmond": return new e(new g(255, 235, 205, 1));
						case "blue": return new e(new g(0, 0, 255, 1));
						case "blueviolet": return new e(new g(138, 43, 226, 1));
						case "brown": return new e(new g(165, 42, 42, 1));
						case "burlywood": return new e(new g(222, 184, 135, 1));
						case "cadetblue": return new e(new g(95, 158, 160, 1));
						case "chartreuse": return new e(new g(127, 255, 0, 1));
						case "chocolate": return new e(new g(210, 105, 30, 1));
						case "coral": return new e(new g(255, 127, 80, 1));
						case "cornflowerblue": return new e(new g(100, 149, 237, 1));
						case "cornsilk": return new e(new g(255, 248, 220, 1));
						case "crimson": return new e(new g(220, 20, 60, 1));
						case "cyan": return new e(new g(0, 255, 255, 1));
						case "darkblue": return new e(new g(0, 0, 139, 1));
						case "darkcyan": return new e(new g(0, 139, 139, 1));
						case "darkgoldenrod": return new e(new g(184, 134, 11, 1));
						case "darkgray": return new e(new g(169, 169, 169, 1));
						case "darkgreen": return new e(new g(0, 100, 0, 1));
						case "darkgrey": return new e(new g(169, 169, 169, 1));
						case "darkkhaki": return new e(new g(189, 183, 107, 1));
						case "darkmagenta": return new e(new g(139, 0, 139, 1));
						case "darkolivegreen": return new e(new g(85, 107, 47, 1));
						case "darkorange": return new e(new g(255, 140, 0, 1));
						case "darkorchid": return new e(new g(153, 50, 204, 1));
						case "darkred": return new e(new g(139, 0, 0, 1));
						case "darksalmon": return new e(new g(233, 150, 122, 1));
						case "darkseagreen": return new e(new g(143, 188, 143, 1));
						case "darkslateblue": return new e(new g(72, 61, 139, 1));
						case "darkslategray": return new e(new g(47, 79, 79, 1));
						case "darkslategrey": return new e(new g(47, 79, 79, 1));
						case "darkturquoise": return new e(new g(0, 206, 209, 1));
						case "darkviolet": return new e(new g(148, 0, 211, 1));
						case "deeppink": return new e(new g(255, 20, 147, 1));
						case "deepskyblue": return new e(new g(0, 191, 255, 1));
						case "dimgray": return new e(new g(105, 105, 105, 1));
						case "dimgrey": return new e(new g(105, 105, 105, 1));
						case "dodgerblue": return new e(new g(30, 144, 255, 1));
						case "firebrick": return new e(new g(178, 34, 34, 1));
						case "floralwhite": return new e(new g(255, 250, 240, 1));
						case "forestgreen": return new e(new g(34, 139, 34, 1));
						case "fuchsia": return new e(new g(255, 0, 255, 1));
						case "gainsboro": return new e(new g(220, 220, 220, 1));
						case "ghostwhite": return new e(new g(248, 248, 255, 1));
						case "gold": return new e(new g(255, 215, 0, 1));
						case "goldenrod": return new e(new g(218, 165, 32, 1));
						case "gray": return new e(new g(128, 128, 128, 1));
						case "green": return new e(new g(0, 128, 0, 1));
						case "greenyellow": return new e(new g(173, 255, 47, 1));
						case "grey": return new e(new g(128, 128, 128, 1));
						case "honeydew": return new e(new g(240, 255, 240, 1));
						case "hotpink": return new e(new g(255, 105, 180, 1));
						case "indianred": return new e(new g(205, 92, 92, 1));
						case "indigo": return new e(new g(75, 0, 130, 1));
						case "ivory": return new e(new g(255, 255, 240, 1));
						case "khaki": return new e(new g(240, 230, 140, 1));
						case "lavender": return new e(new g(230, 230, 250, 1));
						case "lavenderblush": return new e(new g(255, 240, 245, 1));
						case "lawngreen": return new e(new g(124, 252, 0, 1));
						case "lemonchiffon": return new e(new g(255, 250, 205, 1));
						case "lightblue": return new e(new g(173, 216, 230, 1));
						case "lightcoral": return new e(new g(240, 128, 128, 1));
						case "lightcyan": return new e(new g(224, 255, 255, 1));
						case "lightgoldenrodyellow": return new e(new g(250, 250, 210, 1));
						case "lightgray": return new e(new g(211, 211, 211, 1));
						case "lightgreen": return new e(new g(144, 238, 144, 1));
						case "lightgrey": return new e(new g(211, 211, 211, 1));
						case "lightpink": return new e(new g(255, 182, 193, 1));
						case "lightsalmon": return new e(new g(255, 160, 122, 1));
						case "lightseagreen": return new e(new g(32, 178, 170, 1));
						case "lightskyblue": return new e(new g(135, 206, 250, 1));
						case "lightslategray": return new e(new g(119, 136, 153, 1));
						case "lightslategrey": return new e(new g(119, 136, 153, 1));
						case "lightsteelblue": return new e(new g(176, 196, 222, 1));
						case "lightyellow": return new e(new g(255, 255, 224, 1));
						case "lime": return new e(new g(0, 255, 0, 1));
						case "limegreen": return new e(new g(50, 205, 50, 1));
						case "linen": return new e(new g(250, 240, 230, 1));
						case "magenta": return new e(new g(255, 0, 255, 1));
						case "maroon": return new e(new g(128, 0, 0, 1));
						case "mediumaquamarine": return new e(new g(102, 205, 170, 1));
						case "mediumblue": return new e(new g(0, 0, 205, 1));
						case "mediumorchid": return new e(new g(186, 85, 211, 1));
						case "mediumpurple": return new e(new g(147, 112, 219, 1));
						case "mediumseagreen": return new e(new g(60, 179, 113, 1));
						case "mediumslateblue": return new e(new g(123, 104, 238, 1));
						case "mediumspringgreen": return new e(new g(0, 250, 154, 1));
						case "mediumturquoise": return new e(new g(72, 209, 204, 1));
						case "mediumvioletred": return new e(new g(199, 21, 133, 1));
						case "midnightblue": return new e(new g(25, 25, 112, 1));
						case "mintcream": return new e(new g(245, 255, 250, 1));
						case "mistyrose": return new e(new g(255, 228, 225, 1));
						case "moccasin": return new e(new g(255, 228, 181, 1));
						case "navajowhite": return new e(new g(255, 222, 173, 1));
						case "navy": return new e(new g(0, 0, 128, 1));
						case "oldlace": return new e(new g(253, 245, 230, 1));
						case "olive": return new e(new g(128, 128, 0, 1));
						case "olivedrab": return new e(new g(107, 142, 35, 1));
						case "orange": return new e(new g(255, 165, 0, 1));
						case "orangered": return new e(new g(255, 69, 0, 1));
						case "orchid": return new e(new g(218, 112, 214, 1));
						case "palegoldenrod": return new e(new g(238, 232, 170, 1));
						case "palegreen": return new e(new g(152, 251, 152, 1));
						case "paleturquoise": return new e(new g(175, 238, 238, 1));
						case "palevioletred": return new e(new g(219, 112, 147, 1));
						case "papayawhip": return new e(new g(255, 239, 213, 1));
						case "peachpuff": return new e(new g(255, 218, 185, 1));
						case "peru": return new e(new g(205, 133, 63, 1));
						case "pink": return new e(new g(255, 192, 203, 1));
						case "plum": return new e(new g(221, 160, 221, 1));
						case "powderblue": return new e(new g(176, 224, 230, 1));
						case "purple": return new e(new g(128, 0, 128, 1));
						case "rebeccapurple": return new e(new g(102, 51, 153, 1));
						case "red": return new e(new g(255, 0, 0, 1));
						case "rosybrown": return new e(new g(188, 143, 143, 1));
						case "royalblue": return new e(new g(65, 105, 225, 1));
						case "saddlebrown": return new e(new g(139, 69, 19, 1));
						case "salmon": return new e(new g(250, 128, 114, 1));
						case "sandybrown": return new e(new g(244, 164, 96, 1));
						case "seagreen": return new e(new g(46, 139, 87, 1));
						case "seashell": return new e(new g(255, 245, 238, 1));
						case "sienna": return new e(new g(160, 82, 45, 1));
						case "silver": return new e(new g(192, 192, 192, 1));
						case "skyblue": return new e(new g(135, 206, 235, 1));
						case "slateblue": return new e(new g(106, 90, 205, 1));
						case "slategray": return new e(new g(112, 128, 144, 1));
						case "slategrey": return new e(new g(112, 128, 144, 1));
						case "snow": return new e(new g(255, 250, 250, 1));
						case "springgreen": return new e(new g(0, 255, 127, 1));
						case "steelblue": return new e(new g(70, 130, 180, 1));
						case "tan": return new e(new g(210, 180, 140, 1));
						case "teal": return new e(new g(0, 128, 128, 1));
						case "thistle": return new e(new g(216, 191, 216, 1));
						case "tomato": return new e(new g(255, 99, 71, 1));
						case "turquoise": return new e(new g(64, 224, 208, 1));
						case "violet": return new e(new g(238, 130, 238, 1));
						case "wheat": return new e(new g(245, 222, 179, 1));
						case "white": return new e(new g(255, 255, 255, 1));
						case "whitesmoke": return new e(new g(245, 245, 245, 1));
						case "yellow": return new e(new g(255, 255, 0, 1));
						case "yellowgreen": return new e(new g(154, 205, 50, 1));
						default: return null;
					}
				}
				function f(p) {
					const y = p.length;
					if (y === 0 || p.charCodeAt(0) !== 35) return null;
					if (y === 7) return new e(new g(16 * b(p.charCodeAt(1)) + b(p.charCodeAt(2)), 16 * b(p.charCodeAt(3)) + b(p.charCodeAt(4)), 16 * b(p.charCodeAt(5)) + b(p.charCodeAt(6)), 1));
					if (y === 9) return new e(new g(16 * b(p.charCodeAt(1)) + b(p.charCodeAt(2)), 16 * b(p.charCodeAt(3)) + b(p.charCodeAt(4)), 16 * b(p.charCodeAt(5)) + b(p.charCodeAt(6)), (16 * b(p.charCodeAt(7)) + b(p.charCodeAt(8))) / 255));
					if (y === 4) {
						const v = b(p.charCodeAt(1)), L = b(p.charCodeAt(2)), _ = b(p.charCodeAt(3));
						return new e(new g(16 * v + v, 16 * L + L, 16 * _ + _));
					}
					if (y === 5) {
						const v = b(p.charCodeAt(1)), L = b(p.charCodeAt(2)), _ = b(p.charCodeAt(3)), N = b(p.charCodeAt(4));
						return new e(new g(16 * v + v, 16 * L + L, 16 * _ + _, (16 * N + N) / 255));
					}
					return null;
				}
				n.parseHex = f;
				function b(p) {
					switch (p) {
						case 48: return 0;
						case 49: return 1;
						case 50: return 2;
						case 51: return 3;
						case 52: return 4;
						case 53: return 5;
						case 54: return 6;
						case 55: return 7;
						case 56: return 8;
						case 57: return 9;
						case 97: return 10;
						case 65: return 10;
						case 98: return 11;
						case 66: return 11;
						case 99: return 12;
						case 67: return 12;
						case 100: return 13;
						case 68: return 13;
						case 101: return 14;
						case 69: return 14;
						case 102: return 15;
						case 70: return 15;
					}
					return 0;
				}
			})(t.CSS || (t.CSS = {}));
		})(e.Format || (e.Format = {}));
	})(St || (St = {}));
	function Ur(e) {
		const t = [];
		for (const n of e) {
			const r = Number(n);
			(r || r === 0 && n.replace(/\s/g, "") !== "") && t.push(r);
		}
		return t;
	}
	function b1(e, t, n, r) {
		return {
			red: e / 255,
			blue: n / 255,
			green: t / 255,
			alpha: r
		};
	}
	function Ye(e, t) {
		const n = t.index, r = t[0].length;
		if (n === void 0) return;
		const s = e.positionAt(n);
		return {
			startLineNumber: s.lineNumber,
			startColumn: s.column,
			endLineNumber: s.lineNumber,
			endColumn: s.column + r
		};
	}
	function Oa(e, t) {
		if (!e) return;
		const n = St.Format.CSS.parseHex(t);
		if (n) return {
			range: e,
			color: b1(n.rgba.r, n.rgba.g, n.rgba.b, n.rgba.a)
		};
	}
	function Hr(e, t, n) {
		if (!e || t.length !== 1) return;
		const r = Ur(t[0].values());
		return {
			range: e,
			color: b1(r[0], r[1], r[2], n ? r[3] : 1)
		};
	}
	function Wr(e, t, n) {
		if (!e || t.length !== 1) return;
		const r = Ur(t[0].values()), s = new St(new Re(r[0], r[1] / 100, r[2] / 100, n ? r[3] : 1));
		return {
			range: e,
			color: b1(s.rgba.r, s.rgba.g, s.rgba.b, s.rgba.a)
		};
	}
	function Je(e, t) {
		return typeof e == "string" ? [...e.matchAll(t)] : e.findMatches(t);
	}
	function Ga(e) {
		const t = [], n = Je(e, new RegExp(`\\b(rgb|rgba|hsl|hsla)(\\([0-9\\s,.\\%]*\\))|^(#)([A-Fa-f0-9]{3})\\b|^(#)([A-Fa-f0-9]{4})\\b|^(#)([A-Fa-f0-9]{6})\\b|^(#)([A-Fa-f0-9]{8})\\b|(?<=['"\\s])(#)([A-Fa-f0-9]{3})\\b|(?<=['"\\s])(#)([A-Fa-f0-9]{4})\\b|(?<=['"\\s])(#)([A-Fa-f0-9]{6})\\b|(?<=['"\\s])(#)([A-Fa-f0-9]{8})\\b`, "gm"));
		if (n.length > 0) for (const r of n) {
			const s = r.filter((u) => u !== void 0), a = s[1], l = s[2];
			if (!l) continue;
			let o;
			a === "rgb" ? o = Hr(Ye(e, r), Je(l, /^\(\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*\)$/gm), !1) : a === "rgba" ? o = Hr(Ye(e, r), Je(l, /^\(\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(0[.][0-9]+|[.][0-9]+|[01][.]|[01])\s*\)$/gm), !0) : a === "hsl" ? o = Wr(Ye(e, r), Je(l, /^\(\s*((?:360(?:\.0+)?|(?:36[0]|3[0-5][0-9]|[12][0-9][0-9]|[1-9]?[0-9])(?:\.\d+)?))\s*[\s,]\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*[\s,]\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*\)$/gm), !1) : a === "hsla" ? o = Wr(Ye(e, r), Je(l, /^\(\s*((?:360(?:\.0+)?|(?:36[0]|3[0-5][0-9]|[12][0-9][0-9]|[1-9]?[0-9])(?:\.\d+)?))\s*[\s,]\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*[\s,]\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*[\s,]\s*(0[.][0-9]+|[.][0-9]+|[01][.]0*|[01])\s*\)$/gm), !0) : a === "#" && (o = Oa(Ye(e, r), a + l)), o && t.push(o);
		}
		return t;
	}
	function ja(e) {
		return !e || typeof e.getValue != "function" || typeof e.positionAt != "function" ? [] : Ga(e);
	}
	const Xa = /^-+|-+$/g, $r = 100, Qa = 5;
	function Ya(e, t) {
		let n = [];
		if (t.findRegionSectionHeaders && t.foldingRules?.markers) {
			const r = Ja(e, t);
			n = n.concat(r);
		}
		if (t.findMarkSectionHeaders) {
			const r = Za(e, t);
			n = n.concat(r);
		}
		return n;
	}
	function Ja(e, t) {
		const n = [], r = e.getLineCount();
		for (let s = 1; s <= r; s++) {
			const a = e.getLineContent(s), l = a.match(t.foldingRules.markers.start);
			if (l) {
				const o = {
					startLineNumber: s,
					startColumn: l[0].length + 1,
					endLineNumber: s,
					endColumn: a.length + 1
				};
				if (o.endColumn > o.startColumn) {
					const u = {
						range: o,
						...Ka(a.substring(l[0].length)),
						shouldBeInComments: !1
					};
					(u.text || u.hasSeparatorLine) && n.push(u);
				}
			}
		}
		return n;
	}
	function Za(e, t) {
		const n = [], r = e.getLineCount();
		if (!t.markSectionHeaderRegex || t.markSectionHeaderRegex.trim() === "") return n;
		const s = Zi(t.markSectionHeaderRegex), a = new RegExp(t.markSectionHeaderRegex, `gdm${s ? "s" : ""}`);
		if (qs(a)) return n;
		for (let l = 1; l <= r; l += $r - Qa) {
			const o = Math.min(l + $r - 1, r), u = [];
			for (let h = l; h <= o; h++) u.push(e.getLineContent(h));
			const c = u.join(`
`);
			a.lastIndex = 0;
			let m;
			for (; (m = a.exec(c)) !== null;) {
				const h = c.substring(0, m.index), d = (h.match(/\n/g) || []).length, f = l + d, b = m[0].split(`
`), p = b.length, y = f + p - 1, v = h.lastIndexOf(`
`) + 1, L = m.index - v + 1, _ = b[b.length - 1], N = {
					range: {
						startLineNumber: f,
						startColumn: L,
						endLineNumber: y,
						endColumn: p === 1 ? L + m[0].length : _.length + 1
					},
					text: (m.groups ?? {}).label ?? "",
					hasSeparatorLine: ((m.groups ?? {}).separator ?? "") !== "",
					shouldBeInComments: !0
				};
				(N.text || N.hasSeparatorLine) && (n.length === 0 || n[n.length - 1].range.endLineNumber < N.range.startLineNumber) && n.push(N), a.lastIndex = m.index + m[0].length;
			}
		}
		return n;
	}
	function Ka(e) {
		e = e.trim();
		const t = e.startsWith("-");
		return e = e.replace(Xa, ""), {
			text: e,
			hasSeparatorLine: t
		};
	}
	(function() {
		const e = globalThis;
		typeof e.requestIdleCallback != "function" || e.cancelIdleCallback;
	})();
	var t0 = class {
		get isRejected() {
			return this.outcome?.outcome === 1;
		}
		get isSettled() {
			return !!this.outcome;
		}
		constructor() {
			this.p = new Promise((e, t) => {
				this.completeCallback = e, this.errorCallback = t;
			});
		}
		complete(e) {
			return this.isSettled ? Promise.resolve() : new Promise((t) => {
				this.completeCallback(e), this.outcome = {
					outcome: 0,
					value: e
				}, t();
			});
		}
		error(e) {
			return this.isSettled ? Promise.resolve() : new Promise((t) => {
				this.errorCallback(e), this.outcome = {
					outcome: 1,
					value: e
				}, t();
			});
		}
		cancel() {
			return this.error(new A1());
		}
	}, zr;
	(function(e) {
		async function t(r) {
			let s;
			const a = await Promise.all(r.map((l) => l.then((o) => o, (o) => {
				s || (s = o);
			})));
			if (typeof s < "u") throw s;
			return a;
		}
		e.settled = t;
		function n(r) {
			return new Promise(async (s, a) => {
				try {
					await r(s, a);
				} catch (l) {
					a(l);
				}
			});
		}
		e.withAsyncBody = n;
	})(zr || (zr = {}));
	var n0 = class {
		constructor() {
			this._unsatisfiedConsumers = [], this._unconsumedValues = [];
		}
		get hasFinalValue() {
			return !!this._finalValue;
		}
		produce(e) {
			if (this._ensureNoFinalValue(), this._unsatisfiedConsumers.length > 0) {
				const t = this._unsatisfiedConsumers.shift();
				this._resolveOrRejectDeferred(t, e);
			} else this._unconsumedValues.push(e);
		}
		produceFinal(e) {
			this._ensureNoFinalValue(), this._finalValue = e;
			for (const t of this._unsatisfiedConsumers) this._resolveOrRejectDeferred(t, e);
			this._unsatisfiedConsumers.length = 0;
		}
		_ensureNoFinalValue() {
			if (this._finalValue) throw new Z("ProducerConsumer: cannot produce after final value has been set");
		}
		_resolveOrRejectDeferred(e, t) {
			t.ok ? e.complete(t.value) : e.error(t.error);
		}
		consume() {
			if (this._unconsumedValues.length > 0 || this._finalValue) {
				const e = this._unconsumedValues.length > 0 ? this._unconsumedValues.shift() : this._finalValue;
				return e.ok ? Promise.resolve(e.value) : Promise.reject(e.error);
			} else {
				const e = new t0();
				return this._unsatisfiedConsumers.push(e), e.p;
			}
		}
	};
	(class ae {
		constructor(t, n) {
			this._onReturn = n, this._producerConsumer = new n0(), this._iterator = {
				next: () => this._producerConsumer.consume(),
				return: () => (this._onReturn?.(), Promise.resolve({
					done: !0,
					value: void 0
				})),
				throw: async (r) => (this._finishError(r), {
					done: !0,
					value: void 0
				})
			}, queueMicrotask(async () => {
				const r = t({
					emitOne: (s) => this._producerConsumer.produce({
						ok: !0,
						value: {
							done: !1,
							value: s
						}
					}),
					emitMany: (s) => {
						for (const a of s) this._producerConsumer.produce({
							ok: !0,
							value: {
								done: !1,
								value: a
							}
						});
					},
					reject: (s) => this._finishError(s)
				});
				if (!this._producerConsumer.hasFinalValue) try {
					await r, this._finishOk();
				} catch (s) {
					this._finishError(s);
				}
			});
		}
		static fromArray(t) {
			return new ae((n) => {
				n.emitMany(t);
			});
		}
		static fromPromise(t) {
			return new ae(async (n) => {
				n.emitMany(await t);
			});
		}
		static fromPromisesResolveOrder(t) {
			return new ae(async (n) => {
				await Promise.all(t.map(async (r) => n.emitOne(await r)));
			});
		}
		static merge(t) {
			return new ae(async (n) => {
				await Promise.all(t.map(async (r) => {
					for await (const s of r) n.emitOne(s);
				}));
			});
		}
		static #e = this.EMPTY = ae.fromArray([]);
		static map(t, n) {
			return new ae(async (r) => {
				for await (const s of t) r.emitOne(n(s));
			});
		}
		map(t) {
			return ae.map(this, t);
		}
		static coalesce(t) {
			return ae.filter(t, (n) => !!n);
		}
		coalesce() {
			return ae.coalesce(this);
		}
		static filter(t, n) {
			return new ae(async (r) => {
				for await (const s of t) n(s) && r.emitOne(s);
			});
		}
		filter(t) {
			return ae.filter(this, t);
		}
		_finishOk() {
			this._producerConsumer.hasFinalValue || this._producerConsumer.produceFinal({
				ok: !0,
				value: {
					done: !0,
					value: void 0
				}
			});
		}
		_finishError(t) {
			this._producerConsumer.hasFinalValue || this._producerConsumer.produceFinal({
				ok: !1,
				error: t
			});
		}
		[Symbol.asyncIterator]() {
			return this._iterator;
		}
	});
	var r0 = class {
		constructor(e) {
			this.values = e, this.prefixSum = new Uint32Array(e.length), this.prefixSumValidIndex = new Int32Array(1), this.prefixSumValidIndex[0] = -1;
		}
		insertValues(e, t) {
			e = Ee(e);
			const n = this.values, r = this.prefixSum, s = t.length;
			return s === 0 ? !1 : (this.values = new Uint32Array(n.length + s), this.values.set(n.subarray(0, e), 0), this.values.set(n.subarray(e), e + s), this.values.set(t, e), e - 1 < this.prefixSumValidIndex[0] && (this.prefixSumValidIndex[0] = e - 1), this.prefixSum = new Uint32Array(this.values.length), this.prefixSumValidIndex[0] >= 0 && this.prefixSum.set(r.subarray(0, this.prefixSumValidIndex[0] + 1)), !0);
		}
		setValue(e, t) {
			return e = Ee(e), t = Ee(t), this.values[e] === t ? !1 : (this.values[e] = t, e - 1 < this.prefixSumValidIndex[0] && (this.prefixSumValidIndex[0] = e - 1), !0);
		}
		removeValues(e, t) {
			e = Ee(e), t = Ee(t);
			const n = this.values, r = this.prefixSum;
			if (e >= n.length) return !1;
			const s = n.length - e;
			return t >= s && (t = s), t === 0 ? !1 : (this.values = new Uint32Array(n.length - t), this.values.set(n.subarray(0, e), 0), this.values.set(n.subarray(e + t), e), this.prefixSum = new Uint32Array(this.values.length), e - 1 < this.prefixSumValidIndex[0] && (this.prefixSumValidIndex[0] = e - 1), this.prefixSumValidIndex[0] >= 0 && this.prefixSum.set(r.subarray(0, this.prefixSumValidIndex[0] + 1)), !0);
		}
		getTotalSum() {
			return this.values.length === 0 ? 0 : this._getPrefixSum(this.values.length - 1);
		}
		getPrefixSum(e) {
			return e < 0 ? 0 : (e = Ee(e), this._getPrefixSum(e));
		}
		_getPrefixSum(e) {
			if (e <= this.prefixSumValidIndex[0]) return this.prefixSum[e];
			let t = this.prefixSumValidIndex[0] + 1;
			t === 0 && (this.prefixSum[0] = this.values[0], t++), e >= this.values.length && (e = this.values.length - 1);
			for (let n = t; n <= e; n++) this.prefixSum[n] = this.prefixSum[n - 1] + this.values[n];
			return this.prefixSumValidIndex[0] = Math.max(this.prefixSumValidIndex[0], e), this.prefixSum[e];
		}
		getIndexOf(e) {
			e = Math.floor(e), this.getTotalSum();
			let t = 0, n = this.values.length - 1, r = 0, s = 0, a = 0;
			for (; t <= n;) if (r = t + (n - t) / 2 | 0, s = this.prefixSum[r], a = s - this.values[r], e < a) n = r - 1;
			else if (e >= s) t = r + 1;
			else break;
			return new s0(r, e - a);
		}
	}, s0 = class {
		constructor(e, t) {
			this.index = e, this.remainder = t, this._prefixSumIndexOfResultBrand = void 0, this.index = e, this.remainder = t;
		}
	}, i0 = class {
		constructor(e, t, n, r) {
			this._uri = e, this._lines = t, this._eol = n, this._versionId = r, this._lineStarts = null, this._cachedTextValue = null;
		}
		dispose() {
			this._lines.length = 0;
		}
		get version() {
			return this._versionId;
		}
		getText() {
			return this._cachedTextValue === null && (this._cachedTextValue = this._lines.join(this._eol)), this._cachedTextValue;
		}
		onEvents(e) {
			e.eol && e.eol !== this._eol && (this._eol = e.eol, this._lineStarts = null);
			const t = e.changes;
			for (const n of t) this._acceptDeleteRange(n.range), this._acceptInsertText(new W(n.range.startLineNumber, n.range.startColumn), n.text);
			this._versionId = e.versionId, this._cachedTextValue = null;
		}
		_ensureLineStarts() {
			if (!this._lineStarts) {
				const e = this._eol.length, t = this._lines.length, n = new Uint32Array(t);
				for (let r = 0; r < t; r++) n[r] = this._lines[r].length + e;
				this._lineStarts = new r0(n);
			}
		}
		_setLineText(e, t) {
			this._lines[e] = t, this._lineStarts && this._lineStarts.setValue(e, this._lines[e].length + this._eol.length);
		}
		_acceptDeleteRange(e) {
			if (e.startLineNumber === e.endLineNumber) {
				if (e.startColumn === e.endColumn) return;
				this._setLineText(e.startLineNumber - 1, this._lines[e.startLineNumber - 1].substring(0, e.startColumn - 1) + this._lines[e.startLineNumber - 1].substring(e.endColumn - 1));
				return;
			}
			this._setLineText(e.startLineNumber - 1, this._lines[e.startLineNumber - 1].substring(0, e.startColumn - 1) + this._lines[e.endLineNumber - 1].substring(e.endColumn - 1)), this._lines.splice(e.startLineNumber, e.endLineNumber - e.startLineNumber), this._lineStarts && this._lineStarts.removeValues(e.startLineNumber, e.endLineNumber - e.startLineNumber);
		}
		_acceptInsertText(e, t) {
			if (t.length === 0) return;
			const n = Us(t);
			if (n.length === 1) {
				this._setLineText(e.lineNumber - 1, this._lines[e.lineNumber - 1].substring(0, e.column - 1) + n[0] + this._lines[e.lineNumber - 1].substring(e.column - 1));
				return;
			}
			n[n.length - 1] += this._lines[e.lineNumber - 1].substring(e.column - 1), this._setLineText(e.lineNumber - 1, this._lines[e.lineNumber - 1].substring(0, e.column - 1) + n[0]);
			const r = new Uint32Array(n.length - 1);
			for (let s = 1; s < n.length; s++) this._lines.splice(e.lineNumber + s - 1, 0, n[s]), r[s - 1] = n[s].length + this._eol.length;
			this._lineStarts && this._lineStarts.insertValues(e.lineNumber, r);
		}
	}, a0 = class {
		constructor() {
			this._models = Object.create(null);
		}
		getModel(e) {
			return this._models[e];
		}
		getModels() {
			const e = [];
			return Object.keys(this._models).forEach((t) => e.push(this._models[t])), e;
		}
		$acceptNewModel(e) {
			this._models[e.url] = new l0(e1.parse(e.url), e.lines, e.EOL, e.versionId);
		}
		$acceptModelChanged(e, t) {
			this._models[e] && this._models[e].onEvents(t);
		}
		$acceptRemovedModel(e) {
			this._models[e] && delete this._models[e];
		}
	}, l0 = class extends i0 {
		get uri() {
			return this._uri;
		}
		get eol() {
			return this._eol;
		}
		getValue() {
			return this.getText();
		}
		findMatches(e) {
			const t = [];
			for (let n = 0; n < this._lines.length; n++) {
				const r = this._lines[n], s = this.offsetAt(new W(n + 1, 1)), a = r.matchAll(e);
				for (const l of a) (l.index || l.index === 0) && (l.index = l.index + s), t.push(l);
			}
			return t;
		}
		getLinesContent() {
			return this._lines.slice(0);
		}
		getLineCount() {
			return this._lines.length;
		}
		getLineContent(e) {
			return this._lines[e - 1];
		}
		getWordAtPosition(e, t) {
			const n = l1(e.column, pr(t), this._lines[e.lineNumber - 1], 0);
			return n ? new I(e.lineNumber, n.startColumn, e.lineNumber, n.endColumn) : null;
		}
		words(e) {
			const t = this._lines, n = this._wordenize.bind(this);
			let r = 0, s = "", a = 0, l = [];
			return { *[Symbol.iterator]() {
				for (;;) if (a < l.length) {
					const o = s.substring(l[a].start, l[a].end);
					a += 1, yield o;
				} else if (r < t.length) s = t[r], l = n(s, e), a = 0, r += 1;
				else break;
			} };
		}
		getLineWords(e, t) {
			const n = this._lines[e - 1], r = this._wordenize(n, t), s = [];
			for (const a of r) s.push({
				word: n.substring(a.start, a.end),
				startColumn: a.start + 1,
				endColumn: a.end + 1
			});
			return s;
		}
		_wordenize(e, t) {
			const n = [];
			let r;
			for (t.lastIndex = 0; (r = t.exec(e)) && r[0].length !== 0;) n.push({
				start: r.index,
				end: r.index + r[0].length
			});
			return n;
		}
		getValueInRange(e) {
			if (e = this._validateRange(e), e.startLineNumber === e.endLineNumber) return this._lines[e.startLineNumber - 1].substring(e.startColumn - 1, e.endColumn - 1);
			const t = this._eol, n = e.startLineNumber - 1, r = e.endLineNumber - 1, s = [];
			s.push(this._lines[n].substring(e.startColumn - 1));
			for (let a = n + 1; a < r; a++) s.push(this._lines[a]);
			return s.push(this._lines[r].substring(0, e.endColumn - 1)), s.join(t);
		}
		offsetAt(e) {
			return e = this._validatePosition(e), this._ensureLineStarts(), this._lineStarts.getPrefixSum(e.lineNumber - 2) + (e.column - 1);
		}
		positionAt(e) {
			e = Math.floor(e), e = Math.max(0, e), this._ensureLineStarts();
			const t = this._lineStarts.getIndexOf(e), n = this._lines[t.index].length;
			return {
				lineNumber: 1 + t.index,
				column: 1 + Math.min(t.remainder, n)
			};
		}
		_validateRange(e) {
			const t = this._validatePosition({
				lineNumber: e.startLineNumber,
				column: e.startColumn
			}), n = this._validatePosition({
				lineNumber: e.endLineNumber,
				column: e.endColumn
			});
			return t.lineNumber !== e.startLineNumber || t.column !== e.startColumn || n.lineNumber !== e.endLineNumber || n.column !== e.endColumn ? {
				startLineNumber: t.lineNumber,
				startColumn: t.column,
				endLineNumber: n.lineNumber,
				endColumn: n.column
			} : e;
		}
		_validatePosition(e) {
			if (!W.isIPosition(e)) throw new Error("bad position");
			let { lineNumber: t, column: n } = e, r = !1;
			if (t < 1) t = 1, n = 1, r = !0;
			else if (t > this._lines.length) t = this._lines.length, n = this._lines[t - 1].length + 1, r = !0;
			else {
				const s = this._lines[t - 1].length + 1;
				n < 1 ? (n = 1, r = !0) : n > s && (n = s, r = !0);
			}
			return r ? {
				lineNumber: t,
				column: n
			} : e;
		}
	}, o0 = class Dt {
		constructor(t = null) {
			this._foreignModule = t, this._requestHandlerBrand = void 0, this._workerTextModelSyncServer = new a0();
		}
		dispose() {}
		async $ping() {
			return "pong";
		}
		_getModel(t) {
			return this._workerTextModelSyncServer.getModel(t);
		}
		getModels() {
			return this._workerTextModelSyncServer.getModels();
		}
		$acceptNewModel(t) {
			this._workerTextModelSyncServer.$acceptNewModel(t);
		}
		$acceptModelChanged(t, n) {
			this._workerTextModelSyncServer.$acceptModelChanged(t, n);
		}
		$acceptRemovedModel(t) {
			this._workerTextModelSyncServer.$acceptRemovedModel(t);
		}
		async $computeUnicodeHighlights(t, n, r) {
			const s = this._getModel(t);
			return s ? aa.computeUnicodeHighlights(s, n, r) : {
				ranges: [],
				hasMore: !1,
				ambiguousCharacterCount: 0,
				invisibleCharacterCount: 0,
				nonBasicAsciiCharacterCount: 0
			};
		}
		async $findSectionHeaders(t, n) {
			const r = this._getModel(t);
			return r ? Ya(r, n) : [];
		}
		async $computeDiff(t, n, r, s) {
			const a = this._getModel(t), l = this._getModel(n);
			return !a || !l ? null : Dt.computeDiff(a, l, r, s);
		}
		static computeDiff(t, n, r, s) {
			const a = s === "advanced" ? qr.getDefault() : qr.getLegacy(), l = t.getLinesContent(), o = n.getLinesContent(), u = a.computeDiff(l, o, r), c = u.changes.length > 0 ? !1 : this._modelsAreIdentical(t, n);
			function m(h) {
				return h.map((d) => [
					d.original.startLineNumber,
					d.original.endLineNumberExclusive,
					d.modified.startLineNumber,
					d.modified.endLineNumberExclusive,
					d.innerChanges?.map((f) => [
						f.originalRange.startLineNumber,
						f.originalRange.startColumn,
						f.originalRange.endLineNumber,
						f.originalRange.endColumn,
						f.modifiedRange.startLineNumber,
						f.modifiedRange.startColumn,
						f.modifiedRange.endLineNumber,
						f.modifiedRange.endColumn
					])
				]);
			}
			return {
				identical: c,
				quitEarly: u.hitTimeout,
				changes: m(u.changes),
				moves: u.moves.map((h) => [
					h.lineRangeMapping.original.startLineNumber,
					h.lineRangeMapping.original.endLineNumberExclusive,
					h.lineRangeMapping.modified.startLineNumber,
					h.lineRangeMapping.modified.endLineNumberExclusive,
					m(h.changes)
				])
			};
		}
		static _modelsAreIdentical(t, n) {
			const r = t.getLineCount();
			if (r !== n.getLineCount()) return !1;
			for (let s = 1; s <= r; s++) if (t.getLineContent(s) !== n.getLineContent(s)) return !1;
			return !0;
		}
		static #e = this._diffLimit = 1e5;
		async $computeMoreMinimalEdits(t, n, r) {
			const s = this._getModel(t);
			if (!s) return n;
			const a = [];
			let l;
			n = n.slice(0).sort((u, c) => u.range && c.range ? I.compareRangesUsingStarts(u.range, c.range) : (u.range ? 0 : 1) - (c.range ? 0 : 1));
			let o = 0;
			for (let u = 1; u < n.length; u++) I.getEndPosition(n[o].range).equals(I.getStartPosition(n[u].range)) ? (n[o].range = I.fromPositions(I.getStartPosition(n[o].range), I.getEndPosition(n[u].range)), n[o].text += n[u].text) : (o++, n[o] = n[u]);
			n.length = o + 1;
			for (let { range: u, text: c, eol: m } of n) {
				if (typeof m == "number" && (l = m), I.isEmpty(u) && !c) continue;
				const h = s.getValueInRange(u);
				if (c = c.replace(/\r\n|\n|\r/g, s.eol), h === c) continue;
				if (Math.max(c.length, h.length) > Dt._diffLimit) {
					a.push({
						range: u,
						text: c
					});
					continue;
				}
				const d = ai(h, c, r), f = s.offsetAt(I.lift(u).getStartPosition());
				for (const b of d) {
					const p = s.positionAt(f + b.originalStart), y = s.positionAt(f + b.originalStart + b.originalLength), v = {
						text: c.substr(b.modifiedStart, b.modifiedLength),
						range: {
							startLineNumber: p.lineNumber,
							startColumn: p.column,
							endLineNumber: y.lineNumber,
							endColumn: y.column
						}
					};
					s.getValueInRange(v.range) !== v.text && a.push(v);
				}
			}
			return typeof l == "number" && a.push({
				eol: l,
				text: "",
				range: {
					startLineNumber: 0,
					startColumn: 0,
					endLineNumber: 0,
					endColumn: 0
				}
			}), a;
		}
		async $computeLinks(t) {
			const n = this._getModel(t);
			return n ? fi(n) : null;
		}
		async $computeDefaultDocumentColors(t) {
			const n = this._getModel(t);
			return n ? ja(n) : null;
		}
		static #t = this._suggestionsLimit = 1e4;
		async $textualSuggest(t, n, r, s) {
			const a = new k1(), l = new RegExp(r, s), o = /* @__PURE__ */ new Set();
			e: for (const u of t) {
				const c = this._getModel(u);
				if (c) {
					for (const m of c.words(l)) if (!(m === n || !isNaN(Number(m))) && (o.add(m), o.size > Dt._suggestionsLimit)) break e;
				}
			}
			return {
				words: Array.from(o),
				duration: a.elapsed()
			};
		}
		async $computeWordRanges(t, n, r, s) {
			const a = this._getModel(t);
			if (!a) return Object.create(null);
			const l = new RegExp(r, s), o = Object.create(null);
			for (let u = n.startLineNumber; u < n.endLineNumber; u++) {
				const c = a.getLineWords(u, l);
				for (const m of c) {
					if (!isNaN(Number(m.word))) continue;
					let h = o[m.word];
					h || (h = [], o[m.word] = h), h.push({
						startLineNumber: u,
						startColumn: m.startColumn,
						endLineNumber: u,
						endColumn: m.endColumn
					});
				}
			}
			return o;
		}
		async $navigateValueSet(t, n, r, s, a) {
			const l = this._getModel(t);
			if (!l) return null;
			const o = new RegExp(s, a);
			n.startColumn === n.endColumn && (n = {
				startLineNumber: n.startLineNumber,
				startColumn: n.startColumn,
				endLineNumber: n.endLineNumber,
				endColumn: n.endColumn + 1
			});
			const u = l.getValueInRange(n), c = l.getWordAtPosition({
				lineNumber: n.startLineNumber,
				column: n.startColumn
			}, o);
			if (!c) return null;
			const m = l.getValueInRange(c);
			return gi.INSTANCE.navigateValueSet(n, u, c, m, r);
		}
		$fmr(t, n) {
			if (!this._foreignModule || typeof this._foreignModule[t] != "function") return Promise.reject(/* @__PURE__ */ new Error("Missing requestHandler or method: " + t));
			try {
				return Promise.resolve(this._foreignModule[t].apply(this._foreignModule, n));
			} catch (r) {
				return Promise.reject(r);
			}
		}
	};
	typeof importScripts == "function" && (globalThis.monaco = Oi());
	var u0 = class R1 {
		static #e = this.CHANNEL_NAME = "editorWorkerHost";
		static getChannel(t) {
			return t.getChannel(R1.CHANNEL_NAME);
		}
		static setChannel(t, n) {
			t.setChannel(R1.CHANNEL_NAME, n);
		}
	};
	function c0(e) {
		let t;
		const n = ni((r) => {
			const s = u0.getChannel(r);
			return t = e({
				host: new Proxy({}, { get(a, l, o) {
					if (l !== "then") {
						if (typeof l != "string") throw new Error("Not supported");
						return (...u) => s.$fhr(l, u);
					}
				} }),
				getMirrorModels: () => n.requestHandler.getModels()
			}), new o0(t);
		});
		return t;
	}
	let h0 = !1;
	function m0() {
		return h0;
	}
	self.onmessage = () => {
		m0() || c0(() => ({}));
	};
})();
