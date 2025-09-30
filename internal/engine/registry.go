package engine

type Registry struct {
	m map[AttackKind]AttackWorker
}

func NewRegistry() *Registry {
	return &Registry{m: make(map[AttackKind]AttackWorker)}
}

func (r *Registry) Register(kind AttackKind, w AttackWorker) {
	r.m[kind] = w
}

func (r *Registry) Get(kind AttackKind) (AttackWorker, bool) {
	w, ok := r.m[kind]
	return w, ok
}

// ListKinds returns all registered attack kinds.
func (r *Registry) ListKinds() []AttackKind {
	kinds := make([]AttackKind, 0, len(r.m))
	for k := range r.m {
		kinds = append(kinds, k)
	}
	return kinds
}
