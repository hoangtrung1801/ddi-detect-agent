from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

SYSTEM_PROMPT = """
Extract and analyze the active ingredients present in a drug or dietary supplement based on a provided image of its packaging or label.

Carefully review the image to identify text, ingredient lists, supplement facts, or standard labeling used for either medicines or supplements. Focus on locating the section(s) that specifically list active ingredients—including nutrients, vitamins, minerals, botanical extracts, or other bioactive compounds—as well as their strength, dosage, or daily value, and any related details. Examine the context and formatting cues to distinguish active ingredients from inactive components, excipients, or other product information.

Always perform explicit reasoning and deduction first. Call out the evidence/basis in the image for each decision before listing conclusions or classifying content. Do not provide a summary of the active ingredients until after you have detailed your step-by-step analysis.

If information is partially obscured or unclear, label such fields as [unclear]. If no active ingredient(s) are visible, explicitly state that.

## Step-by-step instructions:
1. Carefully scan all text regions in the image.
2. Identify and list all possible ingredient candidates from the identified text.
3. For each candidate, reason through why it should (or should not) be considered an active ingredient:
    - Refer to typical drug or supplement labeling structures, such as "Active Ingredient(s)", "Supplement Facts", "Nutrition Facts", "Contains", or corresponding sections and their placement.
    - For supplements, recognize nutrients (e.g., vitamins, minerals, amino acids), plant or herbal extracts, or other constituents that are known to have physiological effects, as described by the label.
    - If the supplement name itself (e.g., "Vitamin C tablets", "Magnesium capsules", "Ginseng supplement", etc.) directly indicates the likely active ingredient, infer and extract this information even if an explicit ingredient list is missing or unclear. Use your knowledge of common supplement naming conventions to deduce the probable active ingredient(s) when they are implied by the product name.
    - Check for dosage or content indications (e.g., "500 mg Vitamin C", "Zinc 30 mg", "Probiotic blend 10 Billion CFU").
    - Eliminate excipients, inactive/other ingredients, fillers, capsule materials, or substances explicitly labeled as such.
    - If the language is non-English, attempt translation for ingredient names.
4. After reasoning, clearly list the active ingredient(s) and provide any relevant strength/dosage information, if present.
5. If more than one active ingredient is found, enumerate all.

## Output Format:
Return a JSON object with the following structure:
{
  "reasoning_steps": [
    "Step-by-step explanation of how you identified or discounted each active ingredient, referencing image evidence."
  ],
  "active_ingredients": [
    {
      "name": "[ingredient name]",
      "strength": "[dosage/strength if available, e.g., '500 mg' or [unclear]]"
    },
    ...
  ]
}

If no clear active ingredient can be found, set "active_ingredients" to an empty array and explain in "reasoning_steps".

## Example

### Example 1:
**Input image**: (packaging states "Paracetamol 500mg Tablets, Each tablet contains: Paracetamol 500mg. Also contains: starch, magnesium stearate, sodium starch glycolate.")

**Output:**
{
  "reasoning_steps": [
    "Located the section labeled 'Active Ingredient' with 'Paracetamol 500mg.'",
    "Other substances ('starch', 'magnesium stearate', 'sodium starch glycolate') are listed separately as non-active excipients.",
    "Dosage '500mg' is explicitly associated with Paracetamol."
  ],
  "active_ingredients": [
    {
      "name": "Paracetamol",
      "strength": "500 mg"
    }
  ]
}

### Example 2:
**Input image**: (vial with label shows: 'Ibuprofen 400mg/5ml oral suspension. Inactive ingredients: sucrose, sodium, etc.')

**Output:**
{
  "reasoning_steps": [
    "The label shows 'Ibuprofen 400mg/5ml,' indicating the concentration.",
    "A separate list specifies inactive ingredients, so these are disregarded."
  ],
  "active_ingredients": [
    {
      "name": "Ibuprofen",
      "strength": "400 mg/5 ml"
    }
  ]
}

### Example 3:
**Input image**: (low-resolution, main ingredient line partially obscured)

**Output:**
{
  "reasoning_steps": [
    "The label appears to show an active ingredient line, but most characters are obscured.",
    "Cannot confidently identify the ingredient or strength."
  ],
  "active_ingredients": []
}

### Example 4:
**Input image**: (label shows: 'GH Creation EX')

**Output:**
{
  "reasoning_steps": [
    "The label prominently displays 'GH Creation EX+' and molecular diagrams of α-GPC (Alpha-Glyceryl Phosphoryl Choline) with calcium ions (Ca2+).",
    "No explicit 'ingredient list' section is visible, but 'GH Creation' is known as a supplement emphasizing α-GPC as its primary active component supporting growth hormone release.",
    "Supporting compounds such as L-Arginine, L-Ornithine, and L-Lysine are typical cofactors, but α-GPC is the defining active ingredient."
  ],
  "active_ingredients": [
    {
      "name": "Alpha-Glyceryl Phosphoryl Choline (α-GPC)",
      "strength": "[unclear]",
      "evidence": "Molecular structure shown on label and known formulation of GH Creation EX+."
    }
  ]
}


## Important Reminders (repeat for longer prompts)
- Always analyze and explain reasoning steps before presenting conclusions.
- If information is missing or unclear, label as [unclear] in results.
- Only list as active ingredients those explicitly listed as such, or with clear supporting evidence.
- Always output results in the specified JSON format.
"""


class DrugNameExtractAgent:
    """
    Agent for extracting drug names and active ingredients from images of drug packaging or labels.
    Uses vision-capable LLM to analyze images directly.
    """

    def __init__(
        self, model_name: str = "gpt-4o-mini-2024-07-18", verbose: bool = False
    ):
        """
        Initialize the drug name extract agent.

        Args:
            model_name: The name of the vision-capable model to use.
            verbose: Whether to print verbose output.
        """
        self.llm = ChatOpenAI(model=model_name, temperature=0.3, verbose=verbose)
        self.verbose = verbose

    def extract_drug_names_from_image(self, image_url: str) -> list[str]:
        """
        Extract drug names from an image of drug packaging or label.

        Args:
            image_url: URL or base64-encoded image of the drug packaging/label

        Returns:
            JSON string containing reasoning steps and extracted active ingredients
        """

        system_msg = SystemMessage(content=SYSTEM_PROMPT)

        # Create message with image
        messages = [
            system_msg,
            HumanMessage(
                content=[{"type": "image_url", "image_url": {"url": image_url}}]
            ),
        ]

        llm_with_structured_output = self.llm.with_structured_output(LLMResponse)

        result: LLMResponse = llm_with_structured_output.invoke(messages)
        print("Result", result)
        if self.verbose:
            print(f"Agent response: {result}")

        # return result.active_ingredients.map(lambda x: x.model_dump_json()).join(",")
        # extract drug names from the result
        drug_names = list(map(lambda x: x.name, result.active_ingredients))
        return drug_names


class ActiveIngredient(BaseModel):
    """Active ingredient model."""

    name: str = Field(..., description="Name of the active ingredient")
    strength: str = Field(..., description="Strength of the active ingredient")


class LLMResponse(BaseModel):
    """Response model for drug name extraction from image."""

    reasoning_steps: list[str] = Field(..., description="Reasoning steps")
    active_ingredients: list[ActiveIngredient] = Field(
        ..., description="Active ingredients"
    )


if __name__ == "__main__":
    agent = DrugNameExtractAgent(verbose=True)
    # Example with a sample image URL
    # Replace with actual image URL or base64 encoded image
    sample_image_url = "https://example.com/drug-package.jpg"
    result = agent.extract_drug_names_from_image(sample_image_url)
    print(result)
