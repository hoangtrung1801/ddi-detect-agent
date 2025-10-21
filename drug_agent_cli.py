"""
Command-Line Interface for Drug Interaction Agent

Interactive CLI for querying drug interactions using natural language.
"""

import os
import sys
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.prompt import Prompt
from rich import box
from drug_agent import create_agent


class DrugAgentCLI:
    """Interactive command-line interface for the drug interaction agent."""

    def __init__(self, agent, console=None):
        """
        Initialize CLI.

        Args:
            agent: DrugInteractionAgent instance
            console: Rich Console instance (creates new one if None)
        """
        self.agent = agent
        self.console = console or Console()
        self.running = False

    def print_welcome(self):
        """Display welcome message and instructions."""
        welcome_text = """
# 💊 Drug Interaction Agent

An AI-powered assistant for drug interaction queries.

**Available Commands:**
- Type your question naturally (e.g., "What happens if I take Warfarin and Aspirin?")
- `/exit` or `/quit` - Exit the application
- `/clear` - Clear conversation history
- `/stats` - Show database statistics
- `/help` - Show this help message

**Example Questions:**
- "What are the interactions between Warfarin and Aspirin?"
- "Show me all interactions for Metformin"
- "Is it safe to combine Ibuprofen with Alcohol?"
- "Can I take aspirin with warfarin?"
"""
        self.console.print(
            Panel(
                Markdown(welcome_text),
                box=box.DOUBLE,
                border_style="cyan",
                padding=(1, 2),
            )
        )

    def print_stats(self):
        """Display graph statistics."""
        stats = self.agent.get_graph_stats()
        stats_text = f"""
📊 **Database Statistics**

- Total Drugs: {stats['drugs']:,}
- Total Interactions: {stats['interactions']:,}
"""
        self.console.print(Panel(Markdown(stats_text), border_style="green"))

    def handle_command(self, user_input: str) -> bool:
        """
        Handle special commands.

        Args:
            user_input: User's input string

        Returns:
            True if should continue, False if should exit
        """
        command = user_input.lower().strip()

        if command in ["/exit", "/quit"]:
            self.console.print("\n[cyan]👋 Goodbye! Stay safe![/cyan]\n")
            return False

        elif command == "/clear":
            self.agent.clear_memory()
            self.console.print("[green]✓ Conversation history cleared[/green]\n")
            return True

        elif command == "/stats":
            self.print_stats()
            return True

        elif command == "/help":
            self.print_welcome()
            return True

        return True

    def run(self):
        """Run the interactive CLI loop."""
        self.running = True
        self.print_welcome()

        while self.running:
            try:
                # Get user input
                user_input = Prompt.ask("\n[bold cyan]You[/bold cyan]")

                if not user_input.strip():
                    continue

                # Handle commands
                if user_input.startswith("/"):
                    if not self.handle_command(user_input):
                        break
                    continue

                # Process query with agent
                self.console.print(
                    "\n[bold green]Agent[/bold green] [dim](thinking...)[/dim]"
                )

                response = self.agent.query(user_input)

                # Display response
                self.console.print(
                    Panel(response, border_style="green", padding=(1, 2))
                )

            except KeyboardInterrupt:
                self.console.print("\n\n[yellow]⚠ Interrupted by user[/yellow]")
                confirm = Prompt.ask(
                    "Do you want to exit?", choices=["y", "n"], default="n"
                )
                if confirm.lower() == "y":
                    self.console.print("[cyan]👋 Goodbye![/cyan]\n")
                    break
                else:
                    continue

            except Exception as e:
                self.console.print(f"\n[red]❌ Error: {str(e)}[/red]\n")
                continue


def main():
    """Main entry point for CLI."""
    # Load environment variables
    load_dotenv()

    # Check for API key
    if not os.getenv("OPENAI_API_KEY"):
        console = Console()
        console.print(
            "[red]❌ Error: OPENAI_API_KEY not found in environment variables[/red]"
        )
        console.print(
            "[yellow]Please create a .env file with your OpenAI API key:[/yellow]"
        )
        console.print("[dim]OPENAI_API_KEY=your_api_key_here[/dim]\n")
        sys.exit(1)

    # Get data file path
    data_file = os.getenv("DATA_FILE", "TWOSIDES_preprocessed.csv")

    if not os.path.exists(data_file):
        console = Console()
        console.print(f"[red]❌ Error: Data file '{data_file}' not found[/red]")
        console.print(
            "[yellow]Please ensure the drug interaction data file exists.[/yellow]\n"
        )
        sys.exit(1)

    console = Console()

    try:
        # Create agent
        with console.status("[cyan]Loading drug interaction agent...", spinner="dots"):
            agent = create_agent(
                data_filepath=data_file,
                model_name=os.getenv("OPENAI_MODEL", "gpt-5-mini-2025-08-07"),
                verbose=False,
            )

        # Run CLI
        cli = DrugAgentCLI(agent, console)
        cli.run()

    except Exception as e:
        console.print(f"\n[red]❌ Fatal error: {str(e)}[/red]\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
