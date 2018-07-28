import * as idb from 'idb';
import StorageService from './storage_service.js';

class RetaurantsService  {

  /**
   * Constructor
   * @param {*} checkSWSupport wether the WS support must be performed
   */
  constructor(checkSWSupport=true) {
    const dbPromise =   RetaurantsService.openDatabase(checkSWSupport);
    this.restaurantsDbStorage = new StorageService('restaurants', 'restaurants', dbPromise);
    this.reviewsDbStorage = new StorageService('reviews', 'reviews', dbPromise);
  }

  /**
   * Initialized  restaurants and reviews data
   */
  initData() {
    return Promise.all([
      this.restaurantsDbStorage.initData(),
      this.reviewsDbStorage.initData()]);
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  fetchRestaurantByCuisine(cuisine) {
    return this.restaurantsDbStorage.getIndexedData('by-cusine', cuisine);
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  fetchRestaurantByNeighborhood(neighborhood) {
    return this.restaurantsDbStorage.getIndexedData('by-neighborhood', neighborhood);
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  async fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood) {
    if (cuisine != 'all') { // filter by cuisine
      return this.fetchRestaurantByCuisine(cuisine)
        .then(restaurantsByCusine => {
          if (neighborhood != 'all') { // filter by neighborhood
            restaurantsByCusine = restaurantsByCusine.filter(r => r.neighborhood == neighborhood);
          }
          return restaurantsByCusine;
        });
    }
    if (neighborhood != 'all') { // filter by neighborhood
      return this.fetchRestaurantByNeighborhood(neighborhood);
    }
    return this.restaurantsDbStorage.getAllItems();
  }

  /**
   * Fetch all neighborhoods.
   * Returns a Promise.
   */
  fetchNeighborhoods() {
    return this.restaurantsDbStorage.getUniqueValuesFromIndex('by-neighborhood', 'neighborhood');
  }

  /**
   * Fetch all cuisines.
   * Returns a Promise.
   */
  fetchCuisines() {
    return this.restaurantsDbStorage.getUniqueValuesFromIndex('by-cusine', 'cuisine_type');
  }

  /**
   * Returns a Promise with the corresponding restaurant or undefined if it doesn't exist
   * @param {*} id 
   */
  async getResaurantById(id) {
    const restaurant = await this.restaurantsDbStorage.getItemById(id);
    const reviews = await this.reviewsDbStorage.getIndexedData('by-restaurant', parseInt(id));
    if(reviews) {
      restaurant.reviews = reviews;
    }
    return restaurant;
  }

  /**
   * Changes 'is_favorite' of a restaurant.
   * Synchronization with the server is handeled by the SW.
   * @param {*} id 
   * @param {*} favoriteNewValue 
   */
  async toggleFavorite(id, favoriteNewValue) {
    const restaurant = await this.restaurantsDbStorage.getItemById(id);
    restaurant.is_favorite = favoriteNewValue;
    restaurant.in_sync = false;
    await this.restaurantsDbStorage.storeItem(restaurant);
    const registration = await navigator.serviceWorker.getRegistration('/');
    return registration.sync.register('syncRemoteRestaurant');
  }

  async synchronizeRestaurants() {
    const allRestaurants = await this.restaurantsDbStorage.getAllItems();

    const restaurantUpdatePromises = [];
    
    for (const restaurant of allRestaurants) {
      if(!restaurant.in_sync) {
        const id = restaurant.id;
        //no catch to propagate fetch error if any
        restaurantUpdatePromises.push(
          fetch(`${this.restaurantsDbStorage.objectsApiUrl}/${id}/?is_favorite=${restaurant.is_favorite}`,
            {  method: 'PUT',
              body: JSON.stringify(restaurant), 
              headers:{
                'Content-Type': 'application/json'
              }
            })
            .then(response => { 
              if(response.ok) {
                console.debug(`Sync restaurant ${id} OK`, response.json());
                restaurant.in_sync = true;
                return this.restaurantsDbStorage.storeItem(restaurant);
              }
            })
        );
      }
    }

    return Promise.all(restaurantUpdatePromises);
  }


  /**
   *  
   * Creates/update IDB
   *
   * @param {*} checkSWSupport wether to check SW support
   */
  static openDatabase(checkSWSupport) {
    // No service worker support =>
    // we don't care about having a database
    if (checkSWSupport && !navigator.serviceWorker) {
      return Promise.resolve();
    }

    return idb.open('restaurants-db', 2, function (upgradeDb) {
      if(upgradeDb.oldVersion == 0) { // no db yet
        const store = upgradeDb.createObjectStore('restaurants', { keyPath: 'id' });
        store.createIndex('by-cusine', 'cuisine_type');
        store.createIndex('by-neighborhood', 'neighborhood');
      }
      if(upgradeDb.oldVersion <= 1) { // 1st version already exists
        const reviewsStore = upgradeDb.createObjectStore('reviews', { keyPath: 'id' });
        reviewsStore.createIndex('by-restaurant', 'restaurant_id');
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    if (!restaurant.photograph) {
      return undefined;
    }
    return (`/photos/${restaurant.photograph}`);
  }



  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    if (!google) return;
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: RetaurantsService.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP
    }
    );
    return marker;
  }


}

export default RetaurantsService;