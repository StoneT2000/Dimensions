package main

import (
	"fmt"

	"kit/kit"
)

func main() {
	agent := kit.Agent{}
	agent.Initialize()

	for true {
		fmt.Printf("R\n")
		agent.EndTurn()
		agent.Update()
	}
}
