from app.core.agent import agent_manager
from drug_interaction_graph import DrugInteractionGraph
import pandas as pd


def main():
    agent_manager.initialize_agent()
    agent = agent_manager.get_agent()

    question = "What are the interactions between Vitamin C, B-Complex, Vitamin D3, Vitamin B6, Vitamin B12, Folate, Magnesium Bisglycinate, Acid ascorbic, Thiamin HCl, Riboflavin, Pyridoxin HCl, Cyanocobalamin, Nicotinamid?"
    answer = agent.query(question)
    print(answer)


if __name__ == "__main__":
    main()
