package kit
import "fmt"
type Agent struct {
	id int
}

func (agent Agent) Initialize() {
	var id int
	// get agent ID
	fmt.Scanf("%d", &id)
	agent.id = id
	var rounds int
	fmt.Scanf("%d", &rounds)
}

func (agent Agent) Update() {
	var result int
	// get agent ID
	fmt.Scanf("%d", &result)
	var opponentMove string
	fmt.Scanf("%s", &opponentMove)
}

func (agent Agent) EndTurn() {
	fmt.Printf("D_FINISH\n");
}