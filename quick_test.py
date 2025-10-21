from drug_interaction_graph import DrugInteractionGraph


def main():
    graph = DrugInteractionGraph("drug_interactions.graphml")

    all_interactions = graph.get_all_interactions_for_drug("Temazepam")

    # count same condition from a drug
    cnt = {}
    for it in all_interactions:
        if it["condition"] not in cnt:
            cnt[it["condition"]] = 1
        else:
            cnt[it["condition"]] += 1

    print(cnt)

    # test_interaction = graph.search_interaction("Temazepam", "sildenafil")
    # print(test_interaction)

    # vs = graph.graph.vs
    # for v in vs:
    #     print(v)


if __name__ == "__main__":
    main()
