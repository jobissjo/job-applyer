from app.services.scraper.cyberpark import CyberparkScraper
from app.services.scraper.infopark import InfoparkScraper
from app.services.scraper.technopark import TechnoparkScraper
from app.services.scraper.ulcyberpark import ULCyberparkScraper
from app.services.scraper.smartcity import SmartCityScraper


SCRAPERS = {
    "technopark": TechnoparkScraper,
    "infopark": InfoparkScraper,
    "cyberpark": CyberparkScraper,
    "ulcyberpark": ULCyberparkScraper,
    "smartcity": SmartCityScraper,
}


def get_scraper(source: str):
    name = source.lower().strip()
    if name not in SCRAPERS:
        raise ValueError(f"Unsupported job source: {source}")
    return SCRAPERS[name]()
